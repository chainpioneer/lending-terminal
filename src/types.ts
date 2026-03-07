import { ASSETS, Chains } from './constants/constants'

export type Deposit = {
  amount: number
  bn: bigint
  usd: number
}

export type AssetStats = {
  oldUserSupplied: number
  newUserSupplied: number
  newUserSuppliedUsd: number
  oldDailyEarnings: number
  oldDailyEarningsUsd: number
  newDailyEarnings: number
  maxDailyEarnings: number
  maxDailyEarningsUsd: number
  currentAPR: number
  maxAPR: number
}

export type ChainStats = {
  newUserSuppliedUsd: number
  oldDailyEarningsUsd: number
  usd: number
  maxDailyEarningsUsd: number
  currentAPR: number
  maxAPR: number
}

export type Pool = {
  borrowable: string
  platform: string
  supplied: number
  suppliedBN: bigint
  suppliedUsd: number
  kink: number
  utilization: number
  aprOld: number
  tvlUsd: number
  tvl: number
  aprNew: number
  earningsOld: number
  earningsNew: number
  earningsOldUsd: number
  earningsNewUsd: number
  stakingDailyEarningsUsd: number
  stakingAPR: number
  stakingDailyEarnings: number
  stakingRewardAsset: string
  availableToDeposit: number
  availableToDepositUsd: number
  vaultAPR: number | string
  chain: Chains
  asset: ASSETS
  oppositeSymbol: string
  vault: string
  stable: boolean
}
