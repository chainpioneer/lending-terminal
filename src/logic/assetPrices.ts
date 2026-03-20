import axios from 'axios'

import { assetByTokenId, assetConf, ASSETS } from '../constants/constants'

const assetPrices: { [key: string]: number } = {
  [ASSETS.USDC]: 1.0,
}

const tokenIds = Object.values(assetConf).map(({ tokenId }) => {
  return tokenId
})

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
  } catch {}
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

let pricePromise = updatePrice()

let lastUpdate = new Date().getTime()

export async function waitForPrices() {
  if (new Date().getTime() - 60_000 > lastUpdate) {
    lastUpdate = new Date().getTime()
    pricePromise = updatePrice()
  }
  await pricePromise
}

export function getAssetPrice(asset: ASSETS) {
  if (assetPrices[asset] === undefined) {
    throw new Error(`no price for asset ${asset}`)
  }
  return assetPrices[asset]
}
