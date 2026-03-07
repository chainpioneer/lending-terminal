import { Interface } from 'ethers'

import routerAbi from '../../abi/Router03.json'
import { Chains } from '../constants/constants'

const ROUTER_ADDRESSES: Partial<Record<Chains, string>> = {
  [Chains.SONIC]: '0xcBdf792456367a91708C0036E0678eCFB1f09654',
  [Chains.OP]: '0x9761d46Ef36E07131E8c56af06e35CaC23b9A91E',
  [Chains.BASE]: '0xD7cABeF2c1fD77a31c5ba97C724B82d3e25fC83C',
  [Chains.AVAX]: '0xD18d2B8BaAd0078593a3C020cc3c6c5CD2F5B8b8',
}

const routerIface = new Interface(routerAbi)

const erc20Iface = new Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

const MAX_UINT256 = `0x${'f'.repeat(64)}`

export function getRouterAddress(chain: Chains): string | undefined {
  return ROUTER_ADDRESSES[chain]
}

export function encodeMint(poolToken: string, amount: bigint, to: string, deadline: number): string {
  return routerIface.encodeFunctionData('mint', [poolToken, amount, to, deadline])
}

export function encodeMintETH(poolToken: string, to: string, deadline: number): string {
  return routerIface.encodeFunctionData('mintETH', [poolToken, to, deadline])
}

export function encodeRedeem(poolToken: string, tokens: bigint, to: string, deadline: number): string {
  return routerIface.encodeFunctionData('redeem', [poolToken, tokens, to, deadline, '0x'])
}

export function encodeRedeemETH(poolToken: string, tokens: bigint, to: string, deadline: number): string {
  return routerIface.encodeFunctionData('redeemETH', [poolToken, tokens, to, deadline, '0x'])
}

export function encodeApprove(spender: string, amount: string): string {
  return erc20Iface.encodeFunctionData('approve', [spender, amount])
}

export function encodeAllowance(owner: string, spender: string): string {
  return erc20Iface.encodeFunctionData('allowance', [owner, spender])
}

function getEthereum(): any {
  const ethereum = (window as any).ethereum
  if (!ethereum) throw new Error('No wallet detected')
  return ethereum
}

export async function sendTx(params: { from: string; to: string; data: string; value?: string }): Promise<string> {
  const ethereum = getEthereum()
  return ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ ...params, value: params.value ?? '0x0' }],
  })
}

export async function waitForReceipt(txHash: string): Promise<any> {
  const ethereum = getEthereum()
  for (let i = 0; i < 120; i++) {
    const receipt = await ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    })
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted')
      return receipt
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Transaction not mined after 4 minutes')
}

export async function checkAllowance(token: string, owner: string, spender: string): Promise<bigint> {
  const ethereum = getEthereum()
  const data = encodeAllowance(owner, spender)
  const result = await ethereum.request({
    method: 'eth_call',
    params: [{ to: token, data }, 'latest'],
  })
  return BigInt(result)
}

export async function ensureApproval(token: string, owner: string, spender: string, amount: bigint): Promise<void> {
  const allowance = await checkAllowance(token, owner, spender)
  if (allowance >= amount) return
  const data = encodeApprove(spender, MAX_UINT256)
  const txHash = await sendTx({ from: owner, to: token, data })
  await waitForReceipt(txHash)
}
