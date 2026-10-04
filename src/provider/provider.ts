import { Call, Provider } from 'ethcall'
import { JsonRpcProvider, Network } from 'ethers'
import Web3 from 'web3'

import { CHAIN_CONF, Chains } from '../constants/constants'

export const WEB3_PROVIDERS: { [key: string]: Web3[] } = {}
Object.entries(CHAIN_CONF).forEach(([chain, { rpcUrls }]) => {
  WEB3_PROVIDERS[chain] = rpcUrls.map((x) => new Web3(x))
})

export const ETH_CALL_PROVIDERS: { [key: string]: Provider[] } = {}

Object.entries(CHAIN_CONF).forEach(([chain, { rpcUrls, chainId }]) => {
  ETH_CALL_PROVIDERS[chain] = []
  rpcUrls.forEach((x) => {
    const ethersProvider = new JsonRpcProvider(x, Network.from(chainId), { staticNetwork: true })
    ETH_CALL_PROVIDERS[chain].push(
      new Provider(chainId, ethersProvider, {
        multicall: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', block: 0 },
      }),
    )
  })
})

const lastProviderIndex: { [key: string]: number } = {}
const maxErrCount: { [key: string]: number } = {}
Object.entries(CHAIN_CONF).forEach(([chain, { rpcUrls }]) => {
  lastProviderIndex[chain] = 0
  maxErrCount[chain] = rpcUrls.length * 2
})

export function getCurrentEthCallProvider(chain: Chains) {
  return ETH_CALL_PROVIDERS[chain][lastProviderIndex[chain]]
}

function switchProvider(chain: Chains) {
  const oldProviderIndex = lastProviderIndex[chain]
  const nextProviderIndex = oldProviderIndex + 1
  lastProviderIndex[chain] = nextProviderIndex === WEB3_PROVIDERS[chain].length ? 0 : nextProviderIndex
  console.log(`${chain} switching provider ${oldProviderIndex} -> ${lastProviderIndex[chain]}`)
}

async function multicallWithTimeout(
  chain: Chains,
  requests: Call[],
  method: 'all' | 'tryAll',
  blockNumber?: number,
  timeout = 15_000,
  from = `0x${'0'.repeat(40)}`,
): Promise<any[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxErrCount[chain]; attempt++) {
    try {
      const result = await withTimeout(
        ETH_CALL_PROVIDERS[chain][lastProviderIndex[chain]][method](requests, { blockTag: blockNumber, from }),
        timeout,
      )
      return result
    } catch (error) {
      lastError = error
      switchProvider(chain)
    }
  }
  throw new Error(`${chain} eth_call failed after ${maxErrCount[chain]} attempts`, { cause: lastError })
}

async function withTimeout<T>(request: Promise<T>, timeout: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`RPC timeout after ${timeout}ms`)), timeout)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function callWithTimeout(
  chain: Chains,
  requests: Call[],
  blockNumber?: number,
  timeout?: number,
  from?: string,
): Promise<any[]> {
  return multicallWithTimeout(chain, requests, 'all', blockNumber, timeout, from)
}

export function tryWithTimeout(
  chain: Chains,
  requests: Call[],
  blockNumber?: number,
  timeout?: number,
  from?: string,
): Promise<any[]> {
  return multicallWithTimeout(chain, requests, 'tryAll', blockNumber, timeout, from)
}

export async function web3EthCall(chain: Chains, method: string, params: any[], timeout = 15_000) {
  const providerCount = WEB3_PROVIDERS[chain].length
  for (let i = 0; i < providerCount * 2; i++) {
    const web3: Web3 = WEB3_PROVIDERS[chain][lastProviderIndex[chain]]

    try {
      const result = await withTimeout<any>((web3.eth as any)[method](...params), timeout)
      if (result === undefined) throw new Error('Empty provider response')
      return result
    } catch (e) {
      console.log(`${chain} ${method} failed at provider ${lastProviderIndex[chain]}: ${String(e)}`)
      switchProvider(chain)
    }
  }
  throw new Error(`Web3 eth call failed 2 times: method ${method} provider count ${providerCount}`)
}
