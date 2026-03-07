import { ASSETS } from '../constants/constants'
import { getAssetPrice } from '../logic/assetPrices'
import { Deposit } from '../types'

export type { Deposit }

export function addDeposit(deposit: Deposit, addBN: bigint, div: number, asset: ASSETS) {
  deposit.bn += addBN
  deposit.amount = Number((Number(deposit.bn) / div).toFixed(4))
  deposit.usd = Number(((Number(deposit.bn) / div) * getAssetPrice(asset)).toFixed(2))
}

export function accumulateDeposit(map: any, keys: string[], addBN: bigint, div: number, asset: ASSETS) {
  if (keys.length === 0) {
    addDeposit(map as Deposit, addBN, div, asset)
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const currKey = keys[i]
    if (!map[currKey]) {
      map[currKey] = {}
    }
    map = map[currKey]
  }
  if (map[keys[keys.length - 1]]) {
    addDeposit(map[keys[keys.length - 1]] as Deposit, addBN, div, asset)
  } else {
    map[keys[keys.length - 1]] = toDeposit(addBN, div, asset)
  }
}

export function accumulateUsd(map: any, keys: string[], addN: number) {
  if (keys.length === 0) {
    throw new Error('accumulateUsd can be used only for Objects')
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const currKey = keys[i]
    if (!map[currKey]) {
      map[currKey] = {}
    }
    map = map[currKey]
  }
  if (map[keys[keys.length - 1]]) {
    map[keys[keys.length - 1]] = Number((map[keys[keys.length - 1]] + addN).toFixed(2))
  } else {
    map[keys[keys.length - 1]] = addN
  }
}

export function toDeposit(bn: bigint, div: number, asset: ASSETS) {
  return {
    bn,
    amount: Number((Number(bn) / div).toFixed(4)),
    usd: Number(((Number(bn) / div) * getAssetPrice(asset)).toFixed(2)),
  }
}
