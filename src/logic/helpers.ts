import { ASSETS } from '../constants/constants'
import { AssetStats, Deposit } from '../types'

export function populateCumulativeByAsset(
  cumulativeValuesByAsset: any,
  asset: ASSETS,
  oldUserSupplied: number,
  newUserSupplied: number,
  oldDailyEarnings: number,
  newDailyEarnings: number,
  maxDailyEarnings: number,
) {
  if (cumulativeValuesByAsset[asset]) {
    cumulativeValuesByAsset[asset].oldUserSupplied += oldUserSupplied
    cumulativeValuesByAsset[asset].newUserSupplied += newUserSupplied
    cumulativeValuesByAsset[asset].oldDailyEarnings += oldDailyEarnings
    cumulativeValuesByAsset[asset].newDailyEarnings += newDailyEarnings
    cumulativeValuesByAsset[asset].maxDailyEarnings += maxDailyEarnings
  } else {
    cumulativeValuesByAsset[asset] = {
      oldUserSupplied,
      newUserSupplied,
      oldDailyEarnings,
      newDailyEarnings,
      newUserSuppliedUsd: 0,
      oldDailyEarningsUsd: 0,
      maxDailyEarningsUsd: 0,
      currentAPR: 0,
      maxAPR: 0,
      maxDailyEarnings,
    }
  }
}

export function formatStats(stats: AssetStats, price: number, div: number) {
  return [
    ((stats.newUserSupplied / div) * price).toFixed(2),
    ((stats.oldDailyEarnings / div) * price).toFixed(2),
    ((stats.newDailyEarnings / div) * price).toFixed(2),
    ((stats.maxDailyEarnings / div) * price).toFixed(2),
  ]
}

const LIQUIDATION_THRESHOLD_MASK = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFF')
const LIQUIDATION_THRESHOLD_START_BIT_POSITION = 16n

export function getLiquidationThreshold(configuration: bigint): number {
  console.log('configuration', configuration)
  // eslint-disable-next-line no-bitwise
  return Number((configuration & ~LIQUIDATION_THRESHOLD_MASK) >> LIQUIDATION_THRESHOLD_START_BIT_POSITION)
}

export function sortByUserDeposit(byUser: { [user: string]: Deposit }) {
  const sortedUsers = Object.keys(byUser).sort((a, b) => {
    return byUser[b].usd === byUser[a].usd ? byUser[b].amount - byUser[a].amount : byUser[b].usd - byUser[a].usd
  })
  sortedUsers.forEach((x, i) => {
    if (i === 0) return
    const val = byUser[x]
    delete byUser[x]
    byUser[x] = val
  })
}

export function sortByUserSimple(byUser: { [user: string]: number }) {
  const sortedUsers = Object.keys(byUser).sort((a, b) => {
    return byUser[b] - byUser[a]
  })
  sortedUsers.forEach((x, i) => {
    if (i === 0) return
    const val = byUser[x]
    delete byUser[x]
    byUser[x] = val
  })
}
