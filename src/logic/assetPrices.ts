import axios from 'axios'
import { Contract } from 'ethcall'

import { assetByTokenId, assetConf, ASSETS, CHAIN_CONF, Chains } from '../constants/constants'
import { callWithTimeout } from '../provider/provider'

const assetPrices: { [key: string]: number } = {
  [ASSETS.USDC]: 1.0,
}

const tokenIds = Object.values(assetConf).flatMap(({ tokenId }) => (tokenId ? [tokenId] : []))

async function updateAavePrices() {
  const abi = [
    {
      type: 'function',
      name: 'BASE_CURRENCY_UNIT',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'getAssetsPrices',
      stateMutability: 'view',
      inputs: [{ name: 'assets', type: 'address[]' }],
      outputs: [{ type: 'uint256[]' }],
    },
  ]
  await Promise.all(
    (Object.keys(CHAIN_CONF) as Chains[]).map(async (chain) => {
      const assets = Object.values(ASSETS).filter((asset) => assetConf[asset].aave?.chain === chain)
      if (!assets.length) return
      const oracle = new Contract(CHAIN_CONF[chain].aaveOracle!, abi)
      const [unit, prices] = await callWithTimeout(chain, [
        oracle.BASE_CURRENCY_UNIT(),
        oracle.getAssetsPrices(assets.map((asset) => assetConf[asset].aave!.address)),
      ])
      assets.forEach((asset, i) => {
        const price = Number(prices[i]) / Number(unit)
        if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid Aave oracle price for ${asset}`)
        assetPrices[asset] = price
      })
    }),
  )
}

// Fallback for tokens not available on DefiLlama (chain id + token address for DexScreener)
const dexScreenerFallback: { [asset in ASSETS]?: { chain: string; address: string } } = {
  [ASSETS.OX]: { chain: 'base', address: '0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea' },
}

async function fetchDexScreenerPrice(chain: string, address: string): Promise<number | undefined> {
  try {
    const { data } = await axios.get(`https://api.dexscreener.com/tokens/v1/${chain}/${address}`)
    if (Array.isArray(data) && data.length > 0) {
      // Pick the pair with the highest liquidity
      const best = data.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
      if (best.priceUsd) return parseFloat(best.priceUsd)
    }
  } catch {
    // Missing fallback prices are handled by getAssetPrice when requested.
  }
  return undefined
}

async function updatePrice() {
  const coins = tokenIds.map((id) => `coingecko:${id}`).join(',')
  const url = `https://coins.llama.fi/prices/current/${coins}`
  const { data } = await axios.get(url)
  for (const [key, val] of Object.entries(data.coins) as [string, { price: number }][]) {
    const tokenId = key.replace('coingecko:', '')
    const asset = assetByTokenId[tokenId]
    assetPrices[asset] = val.price
  }

  // Fallback to DexScreener for missing prices
  const allAssets = Object.values(ASSETS)
  const missing = allAssets.filter((a) => assetPrices[a] === undefined && dexScreenerFallback[a])
  await Promise.all(
    missing.map(async (asset) => {
      const { chain, address } = dexScreenerFallback[asset]!
      const price = await fetchDexScreenerPrice(chain, address)
      if (price !== undefined) assetPrices[asset] = price
    }),
  )
}

let pricePromise = Promise.all([updatePrice(), updateAavePrices()])

let lastUpdate = new Date().getTime()

export async function waitForPrices() {
  if (new Date().getTime() - 60_000 > lastUpdate) {
    lastUpdate = new Date().getTime()
    pricePromise = Promise.all([updatePrice(), updateAavePrices()])
  }
  await pricePromise
}

export function getAssetPrice(asset: ASSETS) {
  if (assetPrices[asset] === undefined) {
    throw new Error(`no price for asset ${asset}`)
  }
  return assetPrices[asset]
}
