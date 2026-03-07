import { Call, Contract } from 'ethcall'

import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  compoundBorrowings: string[]
}

export function parseCompoundCall2Data(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call2Data: any[],
  skipCount: number,
  compoundBorrowings: Contract[],
  lendingProtocolCalls: Call[],
): number {
  conf.compoundBorrowings.forEach((address, i) => {
    const { numAssets, baseAsset } = ctx.compoundBorrowingInfo[chain][address]
    const asset = conf.assets[baseAsset]
    const div = getDiv(asset)
    ctx.compoundBorrowingInfo[chain][address].borrowRate = call2Data[skipCount++]

    let totalDebt = 0n
    users.forEach((u) => {
      const bn = call2Data[skipCount++]
      const debt = toDeposit(bn, div, asset)
      totalDebt += bn
      if (bn > 0) {
        accumulateUsd(ctx.suppliedByUser, [u], -debt.usd)
        console.log('compound debt', -debt.usd)
      }
      accumulateDeposit(ctx.compoundDebtByAsset, [asset], bn, div, asset)

      const rewardEarn =
        (ctx.compoundBorrowingInfo[chain][address].rewardRate * 24n * 365n * 3600n * ONE * bn) /
        ctx.compoundBorrowingInfo[chain][address].totalBorrow /
        10n ** 15n
      const earnings = toDeposit(rewardEarn / 365n, 1e18, ASSETS.COMP)
      accumulateDeposit(ctx.compoundBorrowingReward, [], rewardEarn, 1e18, ASSETS.COMP)
      accumulateDeposit(ctx.compoundBorrowingRewardByBorrowedAsset, [asset], earnings.bn, 1e18, ASSETS.COMP)

      ctx.compoundBorrowingInfo[chain][address].borrowed[u] = { ...debt }
      ctx.compoundBorrowingInfo[chain][address].rewards[u] = { ...earnings }
      ctx.compoundBorrowingInfo[chain][address].spendings[u] = toDeposit(
        (bn * ctx.compoundBorrowingInfo[chain][address].borrowRate * 24n * 3600n) / ONE,
        div,
        asset,
      )
    })
    const _bn = (totalDebt * ctx.compoundBorrowingInfo[chain][address].borrowRate * 365n * 24n * 3600n) / ONE
    if (_bn > 0) {
      console.log('compound spend', totalDebt, ctx.compoundBorrowingInfo[chain][address].borrowRate, _bn)
    }
    accumulateDeposit(ctx.compoundSpendingsByAsset, [asset], _bn, div, asset)

    for (let j = 0; j < numAssets; j++) {
      const assetInfo = call2Data[skipCount++]
      const collateral = assetInfo[1]
      const liquidationRatio = assetInfo[5]
      if (conf.assets[collateral]) {
        ctx.compoundBorrowingInfo[chain][address].collaterals[collateral] = {}
        ctx.compoundBorrowingInfo[chain][address].collateralToAsset[collateral] = conf.assets[collateral]
        ctx.compoundBorrowingInfo[chain][address].liquidationRatio[collateral] = liquidationRatio
        users.forEach((u) => {
          lendingProtocolCalls.push(compoundBorrowings[i].userCollateral(u, collateral))
        })
      }
    }
  })

  return skipCount
}

export function processCompoundCollateral(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  dataFromCall4: any[],
  skipCount: number,
): number {
  conf.compoundBorrowings.forEach((address: string) => {
    Object.keys(ctx.compoundBorrowingInfo[chain][address].collaterals).forEach((collateral) => {
      const asset = conf.assets[collateral]
      const div = getDiv(asset)
      users.forEach((u) => {
        const bn = dataFromCall4[skipCount++][0]
        accumulateDeposit(ctx.compoundCollateralByAsset, [asset], bn, div, asset)
        ctx.compoundBorrowingInfo[chain][address].collaterals[collateral][u] = toDeposit(bn, div, asset)
        if (bn > 0) {
          populateCumulativeByAsset(ctx.cumulativeValuesByAsset, asset, Number(bn), Number(bn), 0, 0, 0)
          console.log('compound deposit', ctx.compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd)
          accumulateUsd(
            ctx.suppliedByUser,
            [u],
            ctx.compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd,
          )
          accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], bn, div, asset)
        }
      })
    })
  })

  return skipCount
}

export function buildCompoundPositions(ctx: LoadContext, chain: Chains) {
  Object.keys(ctx.compoundBorrowingInfo[chain]).forEach((address) => {
    Object.keys(ctx.compoundBorrowingInfo[chain][address].borrowed).forEach((u) => {
      if (ctx.compoundBorrowingInfo[chain][address].borrowed[u].bn === 0n) return
      console.log('position', u)
      const borrowedUsd = ctx.compoundBorrowingInfo[chain][address].borrowed[u].usd
      let collateralizationUsd = 0
      let collateralTotalUsd = 0
      Object.keys(ctx.compoundBorrowingInfo[chain][address].collaterals).forEach((collateral) => {
        if (ctx.compoundBorrowingInfo[chain][address].collaterals[collateral][u]) {
          const collateralUsd = ctx.compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd
          collateralTotalUsd += collateralUsd
          collateralizationUsd +=
            (collateralUsd * Number(ctx.compoundBorrowingInfo[chain][address].liquidationRatio[collateral])) / 1e18
        }
      })
      const healthFactor = Number((collateralizationUsd / borrowedUsd).toFixed(2))
      const liquidationPrice = Number(
        (collateralizationUsd / ctx.compoundBorrowingInfo[chain][address].borrowed[u].amount).toFixed(2),
      )
      const apr = Number(
        (
          ((ctx.compoundBorrowingInfo[chain][address].rewards[u].usd -
            ctx.compoundBorrowingInfo[chain][address].spendings[u].usd) *
            365 *
            100) /
          collateralTotalUsd
        ).toFixed(2),
      )
      ctx.compoundBorrowingInfo[chain][address].positions[u] = {
        healthFactor,
        liquidationPrice,
        address,
        collateralTotalUsd: Number(collateralTotalUsd.toFixed(2)),
        apr,
      }
    })
  })
}
