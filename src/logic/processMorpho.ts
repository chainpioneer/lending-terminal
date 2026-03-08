import axios from 'axios'
import { Call, Contract } from 'ethcall'

import morphoBlueAbi from '../../abi/MorphoBlue.json' assert { type: 'json' }
import morphoPoolAbi from '../../abi/MorphoPool.json' assert { type: 'json' }
import { ASSETS, Chains, getDiv } from '../constants/constants'
import { callWithTimeout } from '../provider/provider'
import { accumulateDeposit, accumulateUsd, addDeposit, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { getAssetPrice } from './assetPrices'
import { populateCumulativeByAsset } from './helpers'
import { LoadContext } from './loadContext'

type ChainConf = {
  assets: { [addr: string]: ASSETS }
  morpho?: {
    MORPHO: string
    borrowings: string[]
    pools: string[]
    merklCampaignsUrl: string
  }
}

export function parseMorphoCall1Data(
  ctx: LoadContext,
  chain: Chains,
  conf: ChainConf,
  users: string[],
  call1Data: any[],
  calls1: Call[],
  calls3: Call[],
  callIndex: number,
): number {
  conf.morpho!.pools.forEach((pool) => {
    console.log('expected asset call', calls1[callIndex])
    const assetAddress = call1Data[callIndex++]
    const totalAssetCall = calls1[callIndex]
    calls3.push(totalAssetCall)
    const totalAssets = call1Data[callIndex++]
    const totalSupplyCall = calls1[callIndex]
    calls3.push(totalSupplyCall)
    const totalSupply = call1Data[callIndex++]
    const fee = call1Data[callIndex++]
    const withdrawQueueLength = Number(call1Data[callIndex++])
    const asset = conf.assets[assetAddress]
    ctx.morphoPoolInfo[chain][pool] = {
      aggregatedDeposit: { bn: 0n, usd: 0, amount: 0 },
      asset,
      totalSupply,
      apr: 0,
      interestRate: 0n,
      rewardRate: 0n,
      fee,
      tvl: totalAssets,
      supplied: {},
      withdrawQueueLength,
    }
    const poolContract = new Contract(pool, morphoPoolAbi)
    for (let i = 0; i < withdrawQueueLength; i++) {
      calls3.push(poolContract.withdrawQueue(i))
    }
    users.forEach((u) => {
      const balance = call1Data[callIndex++]
      const div = getDiv(asset)
      const assetBalance: bigint = (BigInt(balance * totalAssets) / totalSupply) as bigint
      const deposit = toDeposit(assetBalance, div, asset)
      ctx.morphoPoolInfo[chain][pool].supplied[u] = deposit

      accumulateUsd(ctx.suppliedByUser, [u], deposit.usd)
      accumulateUsd(ctx.suppliedByChainByUser, [chain, u], deposit.usd)
      accumulateDeposit(ctx.suppliedByAssetByUser, [asset, u], deposit.bn, div, asset)
      accumulateDeposit(ctx.suppliedByChainByAssetByUser, [chain, asset, u], deposit.bn, div, asset)
      addDeposit(ctx.morphoPoolInfo[chain][pool].aggregatedDeposit, deposit.bn, div, asset)
    })
  })

  return callIndex
}

export async function processMorphoRewardsAndPools(
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
  let merkleChainData: any

  try {
    const { data } = await axios.get(conf.morpho!.merklCampaignsUrl)
    merkleChainData = data
  } catch (e) {
    console.log(e)
    console.log('failed to fetch merkle incentives for chain', chain)
  }

  // Collect market IDs from supply queues for all pools
  const marketIdsByPool: { [pool: string]: string[] } = {}
  const allMarketIds: Set<string> = new Set()

  conf.morpho!.pools.forEach((pool) => {
    const poolInfo = ctx.morphoPoolInfo[chain][pool]
    const oldTotalAssets = call3Data[cursor++]
    const oldTotalSupply = call3Data[cursor++]
    const marketIds: string[] = []
    for (let i = 0; i < poolInfo.withdrawQueueLength; i++) {
      const marketId = call3Data[cursor++]
      marketIds.push(marketId)
      allMarketIds.add(marketId)
    }
    marketIdsByPool[pool] = marketIds
    // Store old values temporarily for APR calculation
    ;(poolInfo as any)._oldTotalAssets = oldTotalAssets
    ;(poolInfo as any)._oldTotalSupply = oldTotalSupply
  })

  // Fetch market data from Morpho Blue singleton
  const morphoBlue = new Contract(conf.morpho!.MORPHO, morphoBlueAbi)
  const uniqueMarketIds = [...allMarketIds]
  const marketCalls = uniqueMarketIds.map((id) => morphoBlue.market(id))
  const marketDataByMarketId: { [id: string]: { totalSupplyAssets: bigint; totalBorrowAssets: bigint } } = {}

  if (marketCalls.length > 0) {
    try {
      const marketResults = await callWithTimeout(chain, marketCalls, currentBlockNumber)
      uniqueMarketIds.forEach((id, i) => {
        const result = marketResults[i]
        marketDataByMarketId[id] = {
          totalSupplyAssets: BigInt(result.totalSupplyAssets),
          totalBorrowAssets: BigInt(result.totalBorrowAssets),
        }
      })
    } catch (e) {
      console.log('failed to fetch morpho market data', e)
    }
  }

  conf.morpho!.pools.forEach((pool) => {
    let stakingDailyEarnings = 0
    let stakingDailyEarningsBN = 0n
    let stakingDailyEarningsUsd = 0
    let stakingAPR = 0
    let stakingRewardAsset = ''

    const poolInfo = ctx.morphoPoolInfo[chain][pool]

    if (merkleChainData) {
      merkleChainData.forEach((oppData: any) => {
        if (oppData.identifier !== pool) return
        oppData.rewardsRecord.breakdowns.forEach((rewardBreakdown: any) => {
          if (!conf.assets[rewardBreakdown.token.address]) {
            console.log('skipping unknown reward token on Merkle', rewardBreakdown.token.address)
            return
          }
          if (!stakingRewardAsset) {
            stakingRewardAsset = conf.assets[rewardBreakdown.token.address]
          } else if (stakingRewardAsset !== conf.assets[rewardBreakdown.token.address]) {
            console.log('skipping additional reward token on Merkle', rewardBreakdown.token.address)
            return
          }
          const rewardAmountPerDay = BigInt(rewardBreakdown.amount)
          const assetPrice = getAssetPrice(stakingRewardAsset as ASSETS)
          const div = getDiv(stakingRewardAsset as ASSETS)
          const dailyEarnings = Number((poolInfo.aggregatedDeposit.bn * rewardAmountPerDay) / poolInfo.tvl) / div
          stakingDailyEarningsBN += (poolInfo.aggregatedDeposit.bn * rewardAmountPerDay) / poolInfo.tvl
          stakingDailyEarnings += dailyEarnings
          stakingDailyEarningsUsd += dailyEarnings * assetPrice
        })
      })
      accumulateDeposit(
        ctx.morphoRewardsByAsset,
        [poolInfo.asset],
        stakingDailyEarningsBN,
        1e18,
        stakingRewardAsset as ASSETS,
      )
      if (stakingRewardAsset) {
        ctx.morphoRewardToken = stakingRewardAsset as ASSETS
        ctx.morphoRewardTotalAmount += stakingDailyEarnings
        ctx.morphoRewardTotalUsd += stakingDailyEarningsUsd
      }
      stakingAPR = (stakingDailyEarningsUsd * 365 * 100) / poolInfo.aggregatedDeposit.usd
    }

    const oldTotalAssets = (poolInfo as any)._oldTotalAssets
    const oldTotalSupply = (poolInfo as any)._oldTotalSupply
    delete (poolInfo as any)._oldTotalAssets
    delete (poolInfo as any)._oldTotalSupply

    const timeDelta = timestamp ? blockTimestamp - timestamp : (currentBlockNumber - pastBlockNumber) * 2
    const currExchangeRate =
      (ctx.morphoPoolInfo[chain][pool].tvl * ONE * ONE) / ctx.morphoPoolInfo[chain][pool].totalSupply
    const oldExchangeRate = (oldTotalAssets * ONE * ONE) / oldTotalSupply

    poolInfo.interestRate = (currExchangeRate - oldExchangeRate) / BigInt(timeDelta)
    poolInfo.apr =
      Number(
        ((currExchangeRate - oldExchangeRate) * 365n * 24n * 3600n * 10000n) / (BigInt(timeDelta) * oldExchangeRate),
      ) / 100
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
    console.log(ctx.cumulativeValuesByAsset[poolInfo.asset])
    console.log('morpho apr', ctx.morphoPoolInfo[chain][pool].apr)

    // Calculate weighted utilization from underlying Morpho Blue markets
    let totalBorrowAssets = 0n
    let totalSupplyAssets = 0n
    const marketIds = marketIdsByPool[pool]
    if (marketIds) {
      for (const id of marketIds) {
        const md = marketDataByMarketId[id]
        if (md) {
          totalSupplyAssets += md.totalSupplyAssets
          totalBorrowAssets += md.totalBorrowAssets
        }
      }
    }
    const utilization = totalSupplyAssets > 0n ? (totalBorrowAssets * ONE) / totalSupplyAssets : 0n
    console.log('morpho utilization', pool, Number(utilization) / 1e16, '%')

    const asset = poolInfo.asset
    const div = getDiv(asset)
    const availableToDeposit = 0n
    const tvl = toDeposit(poolInfo.tvl, getDiv(poolInfo.asset), poolInfo.asset)
    ctx.pools.push({
      platform: 'MORPHO',
      borrowable: pool,
      asset,
      suppliedBN: poolInfo.aggregatedDeposit.bn,
      supplied: poolInfo.aggregatedDeposit.amount,
      suppliedUsd: poolInfo.aggregatedDeposit.usd,
      tvl: tvl.amount,
      tvlUsd: tvl.usd,
      stakingDailyEarningsUsd: Number(stakingDailyEarningsUsd.toFixed(2)),
      stakingAPR: Number(stakingAPR.toFixed(2)),
      stakingDailyEarnings: Number(stakingDailyEarnings.toFixed(2)),
      stakingRewardAsset,
      kink: 100,
      utilization: Number((Number(utilization) / 1e16).toFixed(2)),
      aprOld: Number(poolInfo.apr.toFixed(2)),
      aprNew: Number(poolInfo.apr.toFixed(2)),
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
      cashBN: 0n,
    })
  })

  return cursor
}
