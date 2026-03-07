import axios from 'axios'

import { assetByTokenId, assetConf, ASSETS } from '../constants/constants'

const assetPrices: { [key: string]: number } = {
  [ASSETS.USDC]: 1.0,
}

const tokenIds = Object.values(assetConf).map(({ tokenId }) => {
  return tokenId
})

async function updatePrice() {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd`
  const { data } = await axios.get(url)
  for (const tokenId in data) {
    const asset = assetByTokenId[tokenId]
    assetPrices[asset] = data[tokenId].usd
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
