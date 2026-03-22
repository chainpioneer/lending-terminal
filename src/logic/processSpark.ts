import axios from 'axios'
import { Call } from 'ethcall'

import { ASSETS, Chains, getDiv } from '../constants/constants'
import { accumulateDeposit, accumulateUsd, addDeposit, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { getAssetPrice } from './assetPrices'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  spark?: {
    pools: string[]
    rewardsCampaignsUrl: string
  }
}

export function parseSparkCall1Data(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call1Data: any[],
  calls1: Call[],
  calls3: Call[],
  callIndex: number,
): number {
  conf.spark!.pools.forEach((pool) => {
    const assetAddress = call1Data[callIndex++]
    const totalAssetCall = calls1[callIndex]
    calls3.push(totalAssetCall)
    const totalAssets = call1Data[callIndex++]
    const totalSupplyCall = calls1[callIndex]
    calls3.push(totalSupplyCall)
    const totalSupply = call1Data[callIndex++]
    const asset = conf.assets[assetAddress]

    ctx.sparkPoolInfo[chain][pool] = {
      aggregatedDeposit: { bn: 0n, usd: 0, amount: 0 },
      asset,
      totalSupply,
      totalAssets,
      apr: 0,
      supplied: {},
    }

    users.forEach((u) => {
      const balance = call1Data[callIndex++]
      const div = getDiv(asset)
      const assetBalance: bigint = totalSupply > 0n ? (BigInt(balance) * totalAssets) / totalSupply : 0n
      const deposit = toDeposit(assetBalance, div, asset)
      ctx.sparkPoolInfo[chain][pool].supplied[u] = deposit

      if (deposit.bn > 0n) {
        accumulateUsd(ctx.suppliedByUser, [u], deposit.usd)
        accumulateUsd(ctx.suppliedByChainByUser, [chain, u], deposit.usd)
        accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], deposit.bn, div, asset)
        accumulateDeposit(ctx.suppliedByChainByAssetByUser, [chain, asset, u], deposit.bn, div, asset)
        accumulateDeposit(ctx.suppliedByChainByBorrowableByUser, [chain, pool, u], deposit.bn, div, asset)
        addDeposit(ctx.sparkPoolInfo[chain][pool].aggregatedDeposit, deposit.bn, div, asset)
      }
    })
  })

  return callIndex
}

export async function processSparkPools(
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
  let campaignData: any = null
  try {
    const { data } = await axios.get(conf.spark!.rewardsCampaignsUrl)
    campaignData = Array.isArray(data) ? data : [data]
  } catch (e) {
    console.log('failed to fetch spark rewards campaigns', e)
  }

  conf.spark!.pools.forEach((pool) => {
    const poolInfo = ctx.sparkPoolInfo[chain][pool]
    const oldTotalAssets = call3Data[cursor++]
    const oldTotalSupply = call3Data[cursor++]

    const timeDelta = timestamp ? blockTimestamp - timestamp : (currentBlockNumber - pastBlockNumber) * 2
    const currExchangeRate =
      poolInfo.totalSupply > 0n ? (poolInfo.totalAssets * ONE * ONE) / poolInfo.totalSupply : ONE * ONE
    const oldExchangeRate = oldTotalSupply > 0n ? (oldTotalAssets * ONE * ONE) / oldTotalSupply : ONE * ONE

    poolInfo.apr =
      oldExchangeRate > 0n
        ? Number(
            ((currExchangeRate - oldExchangeRate) * 365n * 24n * 3600n * 10000n) /
              (BigInt(timeDelta) * oldExchangeRate),
          ) / 100
        : 0

    const totalDeposited = Number(poolInfo.aggregatedDeposit.bn)
    const earnings = (totalDeposited * poolInfo.apr) / 100 / 365

    let stakingAPR = 0
    let stakingDailyEarnings = 0
    let stakingDailyEarningsUsd = 0
    let stakingRewardAsset = ''

    if (campaignData) {
      const campaign = campaignData.find(
        (c: any) => c.incentivized_market_address?.toLowerCase() === pool.toLowerCase(),
      )
      if (campaign) {
        const rewardTokenAddr = campaign.reward_token_address
        const rewardAsset = Object.entries(conf.assets).find(
          ([addr]) => addr.toLowerCase() === rewardTokenAddr?.toLowerCase(),
        )?.[1]
        if (rewardAsset) {
          stakingRewardAsset = rewardAsset
          const apy = Number(campaign.apy)
          stakingAPR = Number((apy * 100).toFixed(2))
          const rewardPrice = getAssetPrice(rewardAsset)
          stakingDailyEarningsUsd = (poolInfo.aggregatedDeposit.usd * apy) / 365
          stakingDailyEarnings = rewardPrice > 0 ? stakingDailyEarningsUsd / rewardPrice : 0

          const rewardDiv = getDiv(rewardAsset)
          const rewardBN = BigInt(Math.round(stakingDailyEarnings * rewardDiv))
          accumulateDeposit(ctx.sparkRewardsByAsset, [poolInfo.asset], rewardBN, rewardDiv, rewardAsset)
          if (!ctx.sparkRewardsByChainByAsset[chain]) ctx.sparkRewardsByChainByAsset[chain] = {}
          accumulateDeposit(ctx.sparkRewardsByChainByAsset[chain], [poolInfo.asset], rewardBN, rewardDiv, rewardAsset)
          accumulateDeposit(ctx.sparkRewardsByChain, [chain], rewardBN, rewardDiv, rewardAsset)
          ctx.sparkRewardToken = rewardAsset
          ctx.sparkRewardTotalAmount += stakingDailyEarnings
          ctx.sparkRewardTotalUsd += stakingDailyEarningsUsd
        } else {
          console.log('skipping unknown spark reward token', rewardTokenAddr)
        }
      }
    }

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
    const tvl = toDeposit(poolInfo.totalAssets, div, asset)

    ctx.pools.push({
      platform: 'SPARK',
      borrowable: pool,
      asset,
      suppliedBN: poolInfo.aggregatedDeposit.bn,
      supplied: poolInfo.aggregatedDeposit.amount,
      suppliedUsd: poolInfo.aggregatedDeposit.usd,
      tvl: tvl.amount,
      tvlUsd: tvl.usd,
      stakingDailyEarningsUsd: Number(stakingDailyEarningsUsd.toFixed(2)),
      stakingAPR,
      stakingDailyEarnings: Number(stakingDailyEarnings.toFixed(4)),
      stakingRewardAsset,
      kink: 100,
      utilization: 0,
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
      vault: '',
      stable: false,
      chain,
      underlying: '',
      exchangeRate: 0n,
      cashBN: 0n,
    })
  })

  return cursor
}
