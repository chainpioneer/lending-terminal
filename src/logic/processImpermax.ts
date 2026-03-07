import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { getAssetPrice } from './assetPrices'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  borrowables: string[]
  staking: { [b: string]: { pool: string; rewardToken: string } }
}

export function processBorrowables(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call1Data: any[],
  callsPerBor: number,
  callsPerStakingPool: number,
  stakingPoolCursor: number,
  blockTimestamp: number,
  pastVaultStateByBorrowable: { [b: string]: { timestamp: number; exchangeRate: bigint; totalBalance: bigint } },
  vaultOrLPByBor: { [b: string]: string },
  stableByBor: { [b: string]: boolean },
  collateralByBorrowable: { [b: string]: string },
  collateralToBorrowables: { [c: string]: string[] },
  symbolByBorrowable: { [b: string]: string },
  vaultExchangeRateAfterReinvestByVault: { [b: string]: bigint },
  vaultBalanceAfterReinvestByVault: { [b: string]: bigint },
): { [v: string]: number | string } {
  const aprByVault: { [v: string]: number | string } = {}

  conf.borrowables.forEach((b, i) => {
    const [
      ,
      underlying,
      oldTotalBalance,
      oldTotalBorrows,
      oldExchangeRate,
      oldBorrowRate, // sync
      ,
      newBorrowRate,
      newTotalBalance,
      newTotalBorrows,
      newExchangeRate,
      reserveFactor,
      name,
      kinkUtilizationRate,
      ...deposits
    ] = call1Data.slice(i * callsPerBor, (i + 1) * callsPerBor)

    if (!conf.assets[underlying]) {
      throw new Error(`${chain} unknown underlying ${underlying} borrowable ${b}`)
    }

    const asset = conf.assets[underlying]
    const div = getDiv(asset)

    let balance: bigint = 0n
    let stakedBalance: bigint = 0n

    for (let j = 0; j < users.length; j++) {
      const user = users[j]
      let _deposit = deposits[j] as bigint
      if (conf.staking[b]) {
        const stakedBn =
          call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 3 + j]
        _deposit += stakedBn
        stakedBalance += stakedBn
      }
      if (_deposit > 0n) {
        const bn = (_deposit * newExchangeRate) / ONE
        const { usd } = toDeposit(bn, div, asset)

        accumulateDeposit(ctx.suppliedByChainByAssetByUser, [chain, asset, user], bn, div, asset)
        accumulateDeposit(ctx.suppliedByAssetByUser, [asset, user], bn, div, asset)
        accumulateDeposit(ctx.suppliedByChainByBorrowableByUser, [chain, b, user], bn, div, asset)
        console.log('borrowable deposit', usd)
        accumulateUsd(ctx.suppliedByUser, [user], usd)
        accumulateUsd(ctx.suppliedByChainByUser, [chain, user], usd)
      }
      balance += _deposit
    }

    const oldUserSupplied = Math.floor(Number((balance * oldExchangeRate) / ONE))
    const suppliedBN = (balance * newExchangeRate) / ONE
    const newUserSupplied = Number(suppliedBN)

    const platform = name.substring(0, name.indexOf(' '))
    const newSupply = newTotalBorrows + newTotalBalance

    const oldDailyYield = (oldBorrowRate * 24n * 3600n * oldTotalBorrows * (ONE - reserveFactor)) / ONE

    const oldSupply = oldTotalBorrows + oldTotalBalance

    const oldDailyApr = Number(oldDailyYield / oldSupply) / 1e18

    const oldDailyEarnings = Math.floor(oldUserSupplied * oldDailyApr)

    const newDailyYield = (newBorrowRate * 3600n * 24n * newTotalBorrows * (ONE - reserveFactor)) / ONE

    let stakingDailyYield = 0n
    let stakingDailyEarningsUsd = 0
    let stakingAPR = 0
    let stakingDailyEarnings = 0
    let stakingRewardAsset: string = ''

    const suppliedUsd = Number(((newUserSupplied * getAssetPrice(asset)) / div).toFixed(2))
    if (conf.staking[b]) {
      const periodFinish = call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool]
      if (periodFinish > blockTimestamp) {
        stakingRewardAsset = conf.assets[conf.staking[b].rewardToken]
        const _div = getDiv(stakingRewardAsset as ASSETS)
        const rewardRate =
          call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 1]
        const totalSupply: bigint =
          call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 2]
        const yearlyRewardUsd =
          (Number(rewardRate * 24n * 3600n * 365n) / _div) * getAssetPrice(stakingRewardAsset as ASSETS)
        stakingDailyYield = (rewardRate * 24n * 3600n * stakedBalance) / totalSupply
        const totalStakedUsd = (Number((totalSupply * newExchangeRate) / ONE) / div) * getAssetPrice(asset)
        stakingAPR = Number(((yearlyRewardUsd * 100) / totalStakedUsd).toFixed(2))
      }
      stakingPoolCursor++
    }

    const newDailyApr = Number(newDailyYield / newSupply) / 1e18
    const newDailyEarnings = Math.floor(newUserSupplied * newDailyApr)
    if (stakingAPR > 0) {
      const _div = getDiv(stakingRewardAsset as ASSETS)
      stakingDailyEarningsUsd =
        stakingDailyYield === 0n
          ? 0
          : Number(((Number(stakingDailyYield) * getAssetPrice(stakingRewardAsset as ASSETS)) / _div).toFixed(2))
      stakingDailyEarnings = Number((Number(stakingDailyYield) / _div).toFixed(4))
    }

    const utilization = (newTotalBorrows * ONE) / newSupply
    const availableToDeposit =
      kinkUtilizationRate >= utilization ? 0n : (newTotalBorrows * ONE) / kinkUtilizationRate - newSupply

    const reinvestPeriod = blockTimestamp - pastVaultStateByBorrowable[b].timestamp

    const v = vaultOrLPByBor[b]

    const bigBalanceChange =
      vaultBalanceAfterReinvestByVault[v] === pastVaultStateByBorrowable[b].totalBalance
        ? false
        : vaultBalanceAfterReinvestByVault[v] > pastVaultStateByBorrowable[b].totalBalance
          ? ((vaultBalanceAfterReinvestByVault[v] - pastVaultStateByBorrowable[b].totalBalance) * 100n) /
              pastVaultStateByBorrowable[b].totalBalance >
            8n
          : ((pastVaultStateByBorrowable[b].totalBalance - vaultBalanceAfterReinvestByVault[v]) * 100n) /
              vaultBalanceAfterReinvestByVault[v] >
            8n
    const vaultAPR = bigBalanceChange
      ? 'unknown'
      : Number(
          (
            (Number(vaultExchangeRateAfterReinvestByVault[v] - pastVaultStateByBorrowable[b].exchangeRate) *
              360000 *
              24 *
              365) /
            reinvestPeriod /
            Number(pastVaultStateByBorrowable[b].exchangeRate)
          ).toFixed(2),
        )

    aprByVault[v] = vaultAPR

    const c = collateralByBorrowable[b]
    const oppositeSymbol =
      collateralToBorrowables[c][0] === b
        ? symbolByBorrowable[collateralToBorrowables[c][1]]
        : symbolByBorrowable[collateralToBorrowables[c][0]]

    ctx.pools.push({
      platform,
      borrowable: b,
      asset,
      suppliedBN,
      tvl: Number((Number(newSupply) / div).toFixed(4)),
      tvlUsd: Number(((Number(newSupply) / div) * getAssetPrice(asset)).toFixed(2)),
      supplied: Number((newUserSupplied / div).toFixed(4)),
      stakingDailyEarningsUsd,
      stakingAPR,
      stakingDailyEarnings,
      stakingRewardAsset,
      suppliedUsd,
      kink: Number(kinkUtilizationRate) / 1e16,
      utilization: Number((Number(utilization) / 1e16).toFixed(2)),
      aprOld: Number((oldDailyApr * 36500).toFixed(2)),
      aprNew: Number((newDailyApr * 36500).toFixed(2)),
      earningsOld: Number((oldDailyEarnings / div).toFixed(4)),
      earningsNew: Number((newDailyEarnings / div).toFixed(4)),
      earningsOldUsd: Number(((oldDailyEarnings * getAssetPrice(asset)) / div).toFixed(2)),
      earningsNewUsd: Number(((newDailyEarnings * getAssetPrice(asset)) / div).toFixed(2)),
      availableToDeposit: Number((Number(availableToDeposit) / div).toFixed(4)),
      availableToDepositUsd: Number(((Number(availableToDeposit) * getAssetPrice(asset)) / div).toFixed(2)),
      oppositeSymbol,
      vaultAPR,
      vault: vaultOrLPByBor[b],
      stable: stableByBor[b],
      chain,
      underlying,
      exchangeRate: newExchangeRate,
      cashBN: newTotalBalance,
    })

    populateCumulativeByAsset(
      ctx.cumulativeValuesByChains[chain],
      asset,
      oldUserSupplied,
      newUserSupplied,
      oldDailyEarnings,
      newDailyEarnings,
      newDailyEarnings > oldDailyEarnings ? newDailyEarnings : oldDailyEarnings,
    )
    populateCumulativeByAsset(
      ctx.cumulativeValuesByAsset,
      asset,
      oldUserSupplied,
      newUserSupplied,
      oldDailyEarnings,
      newDailyEarnings,
      newDailyEarnings > oldDailyEarnings ? newDailyEarnings : oldDailyEarnings,
    )
  })

  return aprByVault
}

export function processCollateralPositions(
  ctx: LoadContext,
  conf: ChainConf,
  users: string[],
  collateralMap: { [c: string]: string[] },
  balanceByCollateralByUser: { [c: string]: { [user: string]: bigint } },
  exchangeRateByCollateral: { [b: string]: bigint },
  vaultByCollateral: { [vault: string]: string },
  vaultExchangeRateAfterReinvestByVault: { [b: string]: bigint },
  borrowableToUnderlying: { [b: string]: string },
  collateralToBorrowables: { [c: string]: string[] },
  symbolByBorrowable: { [b: string]: string },
  reservesByVault: { [b: string]: [bigint, bigint] },
  lpSupplyByVault: { [b: string]: bigint },
  aprByVault: { [v: string]: number | string },
) {
  Object.keys(collateralMap).forEach((col) => {
    const v = vaultByCollateral[col]
    users.forEach((u) => {
      const colBal = balanceByCollateralByUser[col][u]
      if (colBal === 0n) return
      const vaultAmount = (colBal * exchangeRateByCollateral[col]) / ONE
      const lpAmount = (vaultAmount * vaultExchangeRateAfterReinvestByVault[v]) / ONE
      let positionPrice
      if (conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]) {
        const asset = conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]
        const assetAmount = (lpAmount * reservesByVault[v][0] * 2n) / lpSupplyByVault[v]
        const div = getDiv(asset)
        positionPrice = (Number(assetAmount) / div) * getAssetPrice(asset)
      } else {
        const asset = conf.assets[borrowableToUnderlying[collateralToBorrowables[col][1]]]
        const assetAmount = (lpAmount * reservesByVault[v][1] * 2n) / lpSupplyByVault[v]
        const div = getDiv(asset)
        positionPrice = (Number(assetAmount) / div) * getAssetPrice(asset)
      }
      const earnings =
        typeof aprByVault[v] === 'number' ? Number(((positionPrice * aprByVault[v]) / 365 / 100).toFixed(2)) : 0

      const symbol = `${
        symbolByBorrowable[collateralToBorrowables[col][0]] ??
        conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]
      }/${
        symbolByBorrowable[collateralToBorrowables[col][1]] ??
        conf.assets[borrowableToUnderlying[collateralToBorrowables[col][1]]]
      }`
      console.log('collateral earn', u, symbol, positionPrice, earnings)
      ctx.suppliedAsCollateral += positionPrice
      ctx.earningsAsCollateral += earnings
    })
  })
}
