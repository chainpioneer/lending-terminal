import { Call } from 'ethcall'

import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, addDeposit, toDeposit } from '../utils/depositUtils'
import { getAssetPrice } from './assetPrices'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

const Q96 = 2n ** 96n

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  revert?: {
    vaults: string[]
  }
}

export function parseRevertCall1Data(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call1Data: any[],
  calls1: Call[],
  calls3: Call[],
  callIndex: number,
): number {
  conf.revert!.vaults.forEach((vault) => {
    const assetAddress = call1Data[callIndex++]

    // vaultInfo() returns (debt, lent, balance, reserves, debtExchangeRateX96, lendExchangeRateX96)
    const vaultInfoCall = calls1[callIndex]
    calls3.push(vaultInfoCall)
    const vaultInfoResult = call1Data[callIndex++]
    const debt = BigInt(vaultInfoResult[0])
    const lent = BigInt(vaultInfoResult[1])
    const lendExchangeRateX96 = BigInt(vaultInfoResult[5])

    const totalSupply = call1Data[callIndex++]
    const asset = conf.assets[assetAddress]

    ctx.revertPoolInfo[chain][vault] = {
      aggregatedDeposit: { bn: 0n, usd: 0, amount: 0 },
      asset,
      debt,
      lent,
      totalSupply,
      lendExchangeRateX96,
      apr: 0,
      supplied: {},
    }

    const div = getDiv(asset)

    users.forEach((u) => {
      const shares = call1Data[callIndex++]
      // User's asset value = shares * lendExchangeRateX96 / Q96
      const assetBalance: bigint = (BigInt(shares) * lendExchangeRateX96) / Q96
      const deposit = toDeposit(assetBalance, div, asset)
      ctx.revertPoolInfo[chain][vault].supplied[u] = deposit

      accumulateUsd(ctx.suppliedByUser, [u], deposit.usd)
      accumulateUsd(ctx.suppliedByChainByUser, [chain, u], deposit.usd)
      accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], deposit.bn, div, asset)
      accumulateDeposit(ctx.suppliedByChainByAssetByUser, [chain, asset, u], deposit.bn, div, asset)
      accumulateDeposit(ctx.suppliedByChainByBorrowableByUser, [chain, vault, u], deposit.bn, div, asset)
      addDeposit(ctx.revertPoolInfo[chain][vault].aggregatedDeposit, deposit.bn, div, asset)
    })
  })

  return callIndex
}

export async function processRevertPools(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  call3Data: any[],
  cursor: number,
  blockTimestamp: number,
  timestamp: number,
  currentBlockNumber: number,
  pastBlockNumber: number,
): Promise<number> {
  conf.revert!.vaults.forEach((vault) => {
    const poolInfo = ctx.revertPoolInfo[chain][vault]

    // Old vaultInfo from past block
    const oldVaultInfo = call3Data[cursor++]
    const oldLendExchangeRateX96 = BigInt(oldVaultInfo[5])

    const timeDelta = timestamp ? blockTimestamp - timestamp : (currentBlockNumber - pastBlockNumber) * 2

    // APR from lendExchangeRateX96 change
    poolInfo.apr =
      oldLendExchangeRateX96 > 0n
        ? Number(
            ((poolInfo.lendExchangeRateX96 - oldLendExchangeRateX96) * 365n * 24n * 3600n * 10000n) /
              (BigInt(timeDelta) * oldLendExchangeRateX96),
          ) / 100
        : 0

    const totalDeposited = Number(poolInfo.aggregatedDeposit.bn)
    const earnings = (totalDeposited * poolInfo.apr) / 100 / 365

    populateCumulativeByAsset(
      ctx.cumulativeValuesByAsset,
      poolInfo.asset,
      totalDeposited,
      totalDeposited,
      earnings,
      earnings,
      earnings,
    )
    populateCumulativeByAsset(
      ctx.cumulativeValuesByChains[chain],
      poolInfo.asset,
      totalDeposited,
      totalDeposited,
      earnings,
      earnings,
      earnings,
    )

    const asset = poolInfo.asset
    const div = getDiv(asset)
    // TVL = total lent (not just idle balance)
    const tvl = toDeposit(poolInfo.lent, div, asset)
    // Utilization = debt / lent
    const utilization = poolInfo.lent > 0n ? Number((poolInfo.debt * 10000n) / poolInfo.lent) / 100 : 0

    ctx.pools.push({
      platform: 'REVERT',
      borrowable: vault,
      asset,
      suppliedBN: poolInfo.aggregatedDeposit.bn,
      supplied: poolInfo.aggregatedDeposit.amount,
      suppliedUsd: poolInfo.aggregatedDeposit.usd,
      tvl: tvl.amount,
      tvlUsd: tvl.usd,
      stakingDailyEarningsUsd: 0,
      stakingAPR: 0,
      stakingDailyEarnings: 0,
      stakingRewardAsset: '',
      kink: 100,
      utilization: Number(utilization.toFixed(2)),
      aprOld: Number(poolInfo.apr.toFixed(2)),
      aprNew: Number(poolInfo.apr.toFixed(2)),
      earningsOld: Number((earnings / div).toFixed(4)),
      earningsNew: Number((earnings / div).toFixed(4)),
      earningsOldUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      earningsNewUsd: Number(((earnings * getAssetPrice(asset)) / div).toFixed(2)),
      availableToDeposit: 0,
      availableToDepositUsd: 0,
      oppositeSymbol: '',
      vaultAPR: '',
      vault,
      stable: false,
      chain,
      underlying: '',
      exchangeRate: 0n,
      cashBN: 0n,
    })
  })

  return cursor
}
