import axios from 'axios'

import { assetByTokenId, assetConf, ASSETS } from '../constants/constants'

const assetPrices: { [key: string]: number } = {
  [ASSETS.USDC]: 1.0,
}

const tokenIds = Object.values(assetConf).map(({ tokenId }) => {
  return tokenId
})

async function updatePrice() {
  const coins = tokenIds.map((id) => `coingecko:${id}`).join(',')
  const url = `https://coins.llama.fi/prices/current/${coins}`
  const { data } = await axios.get(url)
  for (const [key, val] of Object.entries(data.coins) as [string, { price: number }][]) {
    const tokenId = key.replace('coingecko:', '')
    const asset = assetByTokenId[tokenId]
    assetPrices[asset] = val.price
  }
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
