import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, addDeposit, toDeposit } from '../utils/depositUtils'
import { getAssetPrice } from './assetPrices'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

const E18 = 10n ** 18n

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  extra?: {
    lendingPool: string
    reserveIds: number[]
  }
}

// call1 layout: getReserveStatus(reserveIds), reserves(id) per reserve, getPositionStatus(reserveIds, user) per user
export function processExtraPools(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call1Data: any[],
  callIndex: number,
): number {
  const { reserveIds } = conf.extra!
  const statuses = call1Data[callIndex++]
  const reserves = reserveIds.map(() => call1Data[callIndex++])
  const positions = users.map(() => call1Data[callIndex++])

  reserveIds.forEach((_, i) => {
    // (reserveId, underlyingTokenAddress, eTokenAddress, stakingAddress, totalLiquidity, totalBorrows, exchangeRate, borrowingRate)
    const [, underlying, eToken, , totalLiquidity, totalBorrows, , borrowingRate]: [
      bigint,
      string,
      string,
      string,
      bigint,
      bigint,
      bigint,
      bigint,
    ] = statuses[i]
    // reserves()[7] is the rate config (utilizationA, borrowingRateA, utilizationB, ...) in 1e18, [10] the fee in bps
    const kinkUtilization: bigint = reserves[i][7][2]
    const feeRate: bigint = reserves[i][10]
    const asset = conf.assets[underlying]
    const div = getDiv(asset)

    const supplied = toDeposit(0n, div, asset)
    users.forEach((u, j) => {
      // liquidity = staked + unstaked eTokens converted to the underlying
      const deposit = toDeposit(positions[j][i][4], div, asset)
      if (deposit.bn === 0n) return
      accumulateUsd(ctx.suppliedByUser, [u], deposit.usd)
      accumulateUsd(ctx.suppliedByChainByUser, [chain, u], deposit.usd)
      accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], deposit.bn, div, asset)
      accumulateDeposit(ctx.suppliedByChainByAssetByUser, [chain, asset, u], deposit.bn, div, asset)
      accumulateDeposit(ctx.suppliedByChainByBorrowableByUser, [chain, eToken, u], deposit.bn, div, asset)
      addDeposit(supplied, deposit.bn, div, asset)
    })

    // Supply APR = borrow rate * utilization * (1 - fee). The eToken exchange rate only nets out
    // the fee when the reserve updates, so its short-term change would overstate the APR.
    const apr =
      totalLiquidity > 0n
        ? Number((borrowingRate * totalBorrows * (10000n - feeRate)) / (totalLiquidity * E18)) / 100
        : 0
    const utilization = totalLiquidity > 0n ? Number((totalBorrows * 10000n) / totalLiquidity) / 100 : 0
    // How much can be deposited while utilization stays at or above the kink
    const capacity = kinkUtilization > 0n ? (totalBorrows * E18) / kinkUtilization - totalLiquidity : 0n
    const availableToDeposit = toDeposit(capacity > 0n ? capacity : 0n, div, asset)
    const tvl = toDeposit(totalLiquidity, div, asset)

    const totalDeposited = Number(supplied.bn)
    const earnings = (totalDeposited * apr) / 100 / 365
    populateCumulativeByAsset(
      ctx.cumulativeValuesByAsset,
      asset,
      totalDeposited,
      totalDeposited,
      earnings,
      earnings,
      earnings,
    )
    populateCumulativeByAsset(
      ctx.cumulativeValuesByChains[chain],
      asset,
      totalDeposited,
      totalDeposited,
      earnings,
      earnings,
      earnings,
    )

    ctx.pools.push({
      platform: 'EXTRA',
      borrowable: eToken,
      asset,
      suppliedBN: supplied.bn,
      supplied: supplied.amount,
      suppliedUsd: supplied.usd,
      tvl: tvl.amount,
      tvlUsd: tvl.usd,
      stakingDailyEarningsUsd: 0,
      stakingAPR: 0,
      stakingDailyEarnings: 0,
      stakingRewardAsset: '',
      kink: Number(kinkUtilization / 10n ** 14n) / 100,
      utilization,
      aprOld: apr,
      aprNew: apr,
      earningsOld: Number((earnings / div).toFixed(4)),
      earningsNew: Number((earnings / div).toFixed(4)),
      earningsOldUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      earningsNewUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      availableToDeposit: availableToDeposit.amount,
      availableToDepositUsd: availableToDeposit.usd,
      oppositeSymbol: '',
      vaultAPR: '',
      vault: '',
      stable: false,
      chain,
      underlying: '',
      exchangeRate: 0n,
      cashBN: 0n,
    })
  })

  return callIndex
}
