import { ASSETS } from '../constants/constants'
import { AssetStats, ChainStats, Deposit, Pool } from '../types'

export type CompoundBorrowingEntry = {
  asset: ASSETS
  assetPrice: number
  baseAsset: string
  borrowed: { [user: string]: Deposit }
  rewards: { [user: string]: Deposit }
  spendings: { [user: string]: Deposit }
  supplied: { [asset: string]: Deposit }
  numAssets: number
  borrowRate: bigint
  rewardRate: bigint
  totalBorrow: bigint
  collaterals: { [collateral: string]: { [user: string]: Deposit } }
  collateralToAsset: { [collateral: string]: ASSETS }
  liquidationRatio: { [collateral: string]: bigint }
  positions: {
    [user: string]: {
      healthFactor: number
      liquidationPrice: number
      address: string
      collateralTotalUsd: number
      apr: number
    }
  }
}

export type MorphoPoolEntry = {
  asset: ASSETS
  supplied: { [user: string]: Deposit }
  interestRate: bigint
  rewardRate: bigint
  totalSupply: bigint
  tvl: bigint
  fee: bigint
  apr: number
  aggregatedDeposit: Deposit
}

export type AavePosition = {
  healthFactor: string | number
  collateralTotalUsd: number
  collateralizationUsd: number
  borrowedTotalUsd: number
  apr: number
  earnings: number
  spendings: number
  collaterals: { [asset: string]: Deposit }
  borrows: { [asset: string]: Deposit }
}

export type LoadContext = {
  cumulativeValuesByChains: { [chain: string]: { [asset: string]: AssetStats } }
  chainAggregatedStats: { [chain: string]: ChainStats }
  cumulativeValuesByAsset: { [asset: string]: AssetStats }
  idleBalancesByAsset: { [asset: string]: Deposit }
  aaveABalancesByAsset: { [asset: string]: Deposit }
  compoundCollateralByAsset: { [asset: string]: Deposit }
  compoundDebtByAsset: { [asset: string]: Deposit }
  compoundBorrowingReward: Deposit
  compoundBorrowingRewardByBorrowedAsset: { [asset: string]: Deposit }
  morphoRewardsByAsset: { [asset: string]: Deposit }
  aaveAEarningsByAsset: { [asset: string]: Deposit }
  compoundSpendingsByAsset: { [asset: string]: Deposit }
  aaveVDSpendingsByAsset: { [asset: string]: Deposit }
  aaveVDBalancesByAsset: { [asset: string]: Deposit }
  idleBalancesByChain: { [chain: string]: { [asset: string]: Deposit } }
  aaveABalancesByChainByAsset: { [chain: string]: { [asset: string]: Deposit } }
  aaveABalancesByChainByAssetAddress: { [chain: string]: { [address: string]: Deposit } }
  aaveVDBalancesByChainByAsset: { [asset: string]: { [asset: string]: Deposit } }

  idleBalancesByUser: { [user: string]: number }
  idleBalancesByAssetByUser: { [asset: string]: { [user: string]: Deposit } }
  idleBalancesByChainByUser: { [chain: string]: { [user: string]: number } }
  idleBalancesByChainByAssetByUser: { [chain: string]: { [asset: string]: { [user: string]: Deposit } } }

  suppliedByUser: { [user: string]: number }
  suppliedAsCollateral: number
  earningsAsCollateral: number
  suppliedByAssetByUser: { [asset: string]: { [user: string]: Deposit } }
  suppliedByChainByUser: { [chain: string]: { [user: string]: number } }
  suppliedByChainByAssetByUser: { [chain: string]: { [asset: string]: { [user: string]: Deposit } } }
  suppliedByChainByBorrowableByUser: { [chain: string]: { [borrowable: string]: { [user: string]: Deposit } } }

  aTokenInfo: {
    [asset: string]: { [aToken: string]: { supply: Deposit; borrow: Deposit; kinkUtilizationRatio: bigint } }
  }
  compoundBorrowingInfo: { [chain: string]: { [borrowing: string]: CompoundBorrowingEntry } }
  morphoPoolInfo: { [chain: string]: { [pool: string]: MorphoPoolEntry } }
  aavePositions: { [userChain: string]: AavePosition }
  aaveReserveData: any

  pools: Pool[]
}

export function createLoadContext(): LoadContext {
  return {
    cumulativeValuesByChains: {},
    chainAggregatedStats: {},
    cumulativeValuesByAsset: {},
    idleBalancesByAsset: {},
    aaveABalancesByAsset: {},
    compoundCollateralByAsset: {},
    compoundDebtByAsset: {},
    compoundBorrowingReward: { amount: 0, bn: 0n, usd: 0 },
    compoundBorrowingRewardByBorrowedAsset: {},
    morphoRewardsByAsset: {},
    aaveAEarningsByAsset: {},
    compoundSpendingsByAsset: {},
    aaveVDSpendingsByAsset: {},
    aaveVDBalancesByAsset: {},
    idleBalancesByChain: {},
    aaveABalancesByChainByAsset: {},
    aaveABalancesByChainByAssetAddress: {},
    aaveVDBalancesByChainByAsset: {},

    idleBalancesByUser: {},
    idleBalancesByAssetByUser: {},
    idleBalancesByChainByUser: {},
    idleBalancesByChainByAssetByUser: {},

    suppliedByUser: {},
    suppliedAsCollateral: 0,
    earningsAsCollateral: 0,
    suppliedByAssetByUser: {},
    suppliedByChainByUser: {},
    suppliedByChainByAssetByUser: {},
    suppliedByChainByBorrowableByUser: {},

    aTokenInfo: {},
    compoundBorrowingInfo: {},
    morphoPoolInfo: {},
    aavePositions: {},
    aaveReserveData: {},

    pools: [],
  }
}
