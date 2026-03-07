import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { getAssetPrice } from './assetPrices'
import { getLiquidationThreshold, populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

type ChainConf = {
  assets: { [addr: string]: ASSETS }
}

export function processAaveBalances(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  assetAddressesOnAAVE: string[],
  dataFromCall4: any[],
  skipCount: number,
  userEMode: { [user: string]: number },
  eModeLiqThreshold: { [eMode: number]: number },
) {
  assetAddressesOnAAVE.forEach((reserve: string, i: number) => {
    const asset = conf.assets[reserve]
    const div = getDiv(asset)
    const price = getAssetPrice(asset)
    const aSupply = dataFromCall4[skipCount + i * (users.length * 2 + 3)]
    const vdSupply = dataFromCall4[skipCount + i * (users.length * 2 + 3) + 1]
    ctx.aTokenInfo[chain][reserve] = {
      supply: toDeposit(aSupply, div, asset),
      borrow: toDeposit(vdSupply, div, asset),
      kinkUtilizationRatio: dataFromCall4[skipCount + i * (users.length * 2 + 3) + 2],
    }
    users.forEach((u, j) => {
      const aBalance = dataFromCall4[skipCount + i * (users.length * 2 + 3) + j * 2 + 3] as bigint
      const vdBalance = dataFromCall4[skipCount + i * (users.length * 2 + 3) + j * 2 + 4] as bigint
      const depositUsd = Number(((Number(aBalance) / div) * price).toFixed(2))
      const borrowedUsd = Number(((Number(vdBalance) / div) * price).toFixed(2))
      if (aBalance !== vdBalance) {
        console.log('aave deposit', depositUsd - borrowedUsd)
        accumulateUsd(ctx.suppliedByUser, [u], Number((depositUsd - borrowedUsd).toFixed(2)))
      }

      accumulateDeposit(ctx.aaveABalancesByAsset, [asset], aBalance, div, asset)

      const earnings = (aBalance * ctx.aaveReserveData[chain][reserve][2]) / 10n ** 27n

      accumulateDeposit(ctx.aaveAEarningsByAsset, [asset], earnings, div, asset)

      const earningsUsd = toDeposit(earnings, div, asset).usd

      const spendings = (vdBalance * ctx.aaveReserveData[chain][reserve][4]) / 10n ** 27n
      const spendingsUsd = toDeposit(spendings, div, asset).usd
      accumulateDeposit(ctx.aaveVDSpendingsByAsset, [asset], spendings, div, asset)
      accumulateDeposit(ctx.aaveABalancesByChainByAssetAddress, [chain, reserve], aBalance, div, asset)
      accumulateDeposit(ctx.aaveABalancesByChainByAsset, [chain, asset], aBalance, div, asset)

      if (aBalance > 0) {
        const aToken = ctx.aaveReserveData[chain][reserve][8]
        accumulateDeposit(ctx.suppliedByChainByBorrowableByUser, [chain, aToken, u], aBalance, div, asset)

        const usd = ctx.suppliedByChainByBorrowableByUser[chain][aToken][u].usd
        if (ctx.aavePositions[u + chain]) {
          ctx.aavePositions[u + chain].collateralTotalUsd = Number(
            (ctx.aavePositions[u + chain].collateralTotalUsd + usd).toFixed(2),
          )
          ctx.aavePositions[u + chain].collateralizationUsd = Number(
            (
              ctx.aavePositions[u + chain].collateralizationUsd +
              (usd *
                (userEMode[u] === 1
                  ? eModeLiqThreshold[1]
                  : getLiquidationThreshold(ctx.aaveReserveData[chain][reserve][0][0]))) /
                10_000
            ).toFixed(2),
          )
          if (ctx.aavePositions[u + chain].borrowedTotalUsd !== 0) {
            ctx.aavePositions[u + chain].healthFactor = Number(
              (ctx.aavePositions[u + chain].collateralizationUsd / ctx.aavePositions[u + chain].borrowedTotalUsd).toFixed(2),
            )
          }
          accumulateDeposit(ctx.aavePositions[u + chain].collaterals, [asset], aBalance, div, asset)
          ctx.aavePositions[u + chain].earnings = Number(
            (ctx.aavePositions[u + chain].earnings + earningsUsd / 365).toFixed(2),
          )
          ctx.aavePositions[u + chain].apr = Number(
            (
              ((ctx.aavePositions[u + chain].earnings - ctx.aavePositions[u + chain].spendings) * 365 * 100) /
              ctx.aavePositions[u + chain].collateralTotalUsd
            ).toFixed(2),
          )
        } else {
          ctx.aavePositions[u + chain] = {
            collateralTotalUsd: usd,
            collateralizationUsd: Number(
              (
                (usd *
                  (userEMode[u] === 1
                    ? eModeLiqThreshold[1]
                    : getLiquidationThreshold(ctx.aaveReserveData[chain][reserve][0][0]))) /
                10_000
              ).toFixed(2),
            ),
            borrowedTotalUsd: 0,
            healthFactor: '∞',
            collaterals: {
              [asset]: toDeposit(aBalance, div, asset),
            },
            borrows: {},
            earnings: Number((earningsUsd / 365).toFixed(2)),
            spendings: 0,
            apr: Number(((earningsUsd * 100) / usd).toFixed(2)),
          }
        }

        accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], aBalance, div, asset)

        const earnings = Number(
          (
            Number(
              (ctx.aaveReserveData[chain][reserve][2] * ctx.aaveABalancesByChainByAssetAddress[chain][reserve].bn) / 365n,
            ) / 1e27
          ).toFixed(2),
        )

        populateCumulativeByAsset(
          ctx.cumulativeValuesByAsset,
          asset,
          Number(aBalance),
          Number(aBalance),
          earnings,
          earnings,
          earnings,
        )
      }

      if (vdBalance > 0) {
        const { usd } = toDeposit(vdBalance, div, asset)
        if (ctx.aavePositions[u + chain]) {
          ctx.aavePositions[u + chain].borrowedTotalUsd = Number(
            (ctx.aavePositions[u + chain].borrowedTotalUsd + usd).toFixed(2),
          )
          ctx.aavePositions[u + chain].healthFactor = Number(
            (ctx.aavePositions[u + chain].collateralizationUsd / ctx.aavePositions[u + chain].borrowedTotalUsd).toFixed(2),
          )
          ctx.aavePositions[u + chain].spendings = Number(
            (ctx.aavePositions[u + chain].spendings + spendingsUsd / 365).toFixed(2),
          )
          ctx.aavePositions[u + chain].apr = Number(
            (
              ((ctx.aavePositions[u + chain].earnings - ctx.aavePositions[u + chain].spendings) * 365 * 100) /
              ctx.aavePositions[u + chain].collateralTotalUsd
            ).toFixed(2),
          )
          accumulateDeposit(ctx.aavePositions[u + chain].borrows, [asset], vdBalance, div, asset)
        } else {
          ctx.aavePositions[u + chain] = {
            collateralTotalUsd: 0,
            collateralizationUsd: 0,
            borrowedTotalUsd: usd,
            spendings: Number((spendingsUsd / 365).toFixed(2)),
            apr: 0,
            earnings: 0,
            healthFactor: '∞',
            borrows: { [asset]: toDeposit(vdBalance, div, asset) },
            collaterals: {},
          }
        }
      }
      accumulateDeposit(ctx.aaveVDBalancesByAsset, [asset], vdBalance, div, asset)
      accumulateDeposit(ctx.aaveVDBalancesByChainByAsset, [chain, asset], vdBalance, div, asset)
    })
  })
}

export function buildAavePools(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  assetAddressesOnAAVE: string[],
) {
  assetAddressesOnAAVE.forEach((aaveAsset: string) => {
    const asset = conf.assets[aaveAsset]
    const div = getDiv(asset)
    const utilization = (ctx.aTokenInfo[chain][aaveAsset].borrow.bn * ONE) / ctx.aTokenInfo[chain][aaveAsset].supply.bn
    const availableToDeposit =
      ctx.aTokenInfo[chain][aaveAsset].borrow.bn -
      (ctx.aTokenInfo[chain][aaveAsset].supply.bn * ctx.aTokenInfo[chain][aaveAsset].kinkUtilizationRatio) / 10n ** 27n
    const apr = Number((Number(ctx.aaveReserveData[chain][aaveAsset][2]) / 1e25).toFixed(2))
    const earnings = Number(
      (
        Number(
          (ctx.aaveReserveData[chain][aaveAsset][2] * ctx.aaveABalancesByChainByAssetAddress[chain][aaveAsset].bn) / 365n,
        ) / 1e27
      ).toFixed(2),
    )
    ctx.pools.push({
      platform: 'AAVE',
      borrowable: ctx.aaveReserveData[chain][aaveAsset][8],
      asset,
      suppliedBN: ctx.aaveABalancesByChainByAssetAddress[chain][aaveAsset].bn,
      supplied: ctx.aaveABalancesByChainByAssetAddress[chain][aaveAsset].amount,
      suppliedUsd: ctx.aaveABalancesByChainByAssetAddress[chain][aaveAsset].usd,
      tvl: ctx.aTokenInfo[chain][aaveAsset].supply.amount,
      tvlUsd: ctx.aTokenInfo[chain][aaveAsset].supply.usd,
      stakingDailyEarningsUsd: 0,
      stakingAPR: 0,
      stakingDailyEarnings: 0,
      stakingRewardAsset: '',
      kink: Number((Number(ctx.aTokenInfo[chain][aaveAsset].kinkUtilizationRatio) / 1e25).toFixed(2)),
      utilization: Number((Number(utilization) / 1e16).toFixed(2)),
      aprOld: apr,
      aprNew: apr,
      earningsOld: Number((earnings / div).toFixed(4)),
      earningsNew: Number((earnings / div).toFixed(4)),
      earningsOldUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      earningsNewUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      availableToDeposit: Number((Number(availableToDeposit < 0 ? 0n : availableToDeposit) / div).toFixed(4)),
      availableToDepositUsd: Number(
        ((Number(availableToDeposit < 0 ? 0n : availableToDeposit) * getAssetPrice(asset)) / div).toFixed(2),
      ),
      oppositeSymbol: '',
      vaultAPR: '',
      vault: '',
      stable: false,
      chain,
      underlying: '',
      exchangeRate: 0n,
    })
  })
}
