import { Call, Contract } from 'ethcall'

import interestRateModelAbi from '../../abi/AAVEInterestRateModel.json' assert { type: 'json' }
import aaveLendingPoolAbi from '../../abi/AAVELendingPool.json' assert { type: 'json' }
import aTokenAbi from '../../abi/AToken.json' assert { type: 'json' }
import borrowableAbi from '../../abi/borrowable.json' assert { type: 'json' }
import collateralAbi from '../../abi/collateral.json' assert { type: 'json' }
import compoundBorrowingAbi from '../../abi/CompoundBorrowing.json' assert { type: 'json' }
import morphoPoolAbi from '../../abi/MorphoPool.json' assert { type: 'json' }
import sparkVaultAbi from '../../abi/SparkVault.json' assert { type: 'json' }
import stakingPoolAbi from '../../abi/stakingPool.json' assert { type: 'json' }
import vaultAbi from '../../abi/vault.json' assert { type: 'json' }
import {
  ASSETS,
  CHAIN_CONF,
  Chains,
  DEFAULT_PAST_BLOCK_OFFSET,
  getDiv,
  POOL_FILTER_APR_THRESHOLD,
  POOL_FILTER_CAPACITY_THRESHOLD,
  POOL_FILTER_MIN_TVL,
  SONIC_PAST_BLOCK_OFFSET,
} from '../constants/constants'
import { callWithTimeout, getCurrentEthCallProvider, tryWithTimeout, web3EthCall } from '../provider/provider'
import { accumulateDeposit, accumulateUsd, toDeposit } from '../utils/depositUtils'
import ONE from '../utils/ONE'
import { getAssetPrice, waitForPrices } from './assetPrices'
import { formatStats, sortByUserDeposit, sortByUserSimple } from './helpers'
import { createLoadContext } from './loadContext'
import { buildAavePools, processAaveBalances } from './processAave'
import { buildCompoundPositions, parseCompoundCall2Data, processCompoundCollateral } from './processCompound'
import { processBorrowables, processCollateralPositions } from './processImpermax'
import { parseMorphoCall1Data, processMorphoRewardsAndPools } from './processMorpho'
import { parseSparkCall1Data, processSparkPools } from './processSpark'

export default async function load(users: string[], onChainDone?: (chain: Chains) => void) {
  await waitForPrices()
  const ctx = createLoadContext()

  const chains = Object.keys(CHAIN_CONF) as Chains[]

  async function callChain(chain: Chains) {
    ctx.aTokenInfo[chain] = {}
    ctx.aaveReserveData[chain] = {}
    ctx.cumulativeValuesByChains[chain] = {}
    ctx.chainAggregatedStats[chain] = {
      newUserSuppliedUsd: 0,
      currentAPR: 0,
      oldDailyEarningsUsd: 0,
      usd: 0,
      maxAPR: 0,
      maxDailyEarningsUsd: 0,
    }
    ctx.idleBalancesByChain[chain] = {}
    ctx.compoundBorrowingInfo[chain] = {}
    ctx.morphoPoolInfo[chain] = {}
    ctx.sparkPoolInfo[chain] = {}
    ctx.idleBalancesByChainByAssetByUser[chain] = {}
    ctx.aaveABalancesByChainByAsset[chain] = {}
    ctx.aaveABalancesByChainByAssetAddress[chain] = {}
    ctx.aaveVDBalancesByChainByAsset[chain] = {}
    const blockStruct = await web3EthCall(chain, 'getBlock', ['latest', false])
    const currentBlockNumber = Number(blockStruct.number)
    console.log(chain, 'block number', currentBlockNumber)
    const pastBlockNumber =
      currentBlockNumber - (chain === Chains.SONIC ? SONIC_PAST_BLOCK_OFFSET : DEFAULT_PAST_BLOCK_OFFSET)
    const blockTimestamp = Number(blockStruct.timestamp)
    const conf = CHAIN_CONF[chain as Chains]

    // === Build call1: borrowables, staking pools, compound, AAVE reserves, morpho ===
    let callsPerBor = 0
    const calls1: Call[] = []
    conf.borrowables.forEach((b, i) => {
      const bor = new Contract(b, borrowableAbi)
      calls1.push(
        bor.collateral(),
        bor.underlying(),
        bor.totalBalance(),
        bor.totalBorrows(),
        bor.exchangeRateLast(),
        bor.borrowRate(),
        bor.sync(),
        bor.borrowRate(),
        bor.totalBalance(),
        bor.totalBorrows(),
        bor.exchangeRate(),
        bor.reserveFactor(),
        bor.name(),
        bor.kinkUtilizationRate(),
        ...users.map((u) => bor.balanceOf(u)),
      )
      if (i === 0) {
        callsPerBor = calls1.length
      }
    })
    let callsPerStakingPool = 0
    Object.values(conf.staking).forEach(({ pool, rewardToken }, i) => {
      const stPool = new Contract(pool, stakingPoolAbi)
      calls1.push(
        stPool.periodFinish(rewardToken),
        stPool.rewardRate(rewardToken),
        stPool.totalSupply(),
        ...users.map((u) => stPool.balanceOf(u)),
      )
      if (i === 0) {
        callsPerStakingPool = 3 + users.length
      }
    })

    const compoundBorrowings: Contract[] = []
    conf.compoundBorrowings.forEach((address) => {
      const bor = new Contract(address, compoundBorrowingAbi)
      compoundBorrowings.push(bor)
      calls1.push(bor.baseToken())
      calls1.push(bor.numAssets())
      calls1.push(bor.getUtilization())
      calls1.push(bor.totalBorrow())
      calls1.push(bor.baseTrackingBorrowSpeed())
    })

    let aaveLendingPool: Contract
    if (conf.aaveLendingPool) {
      aaveLendingPool = new Contract(conf.aaveLendingPool, aaveLendingPoolAbi)
      calls1.push(aaveLendingPool.getReservesList())
    }
    //
    const morphoPools: Contract[] = []
    if (conf.morpho) {
      conf.morpho.pools.forEach((address) => {
        const pool = new Contract(address, morphoPoolAbi)
        morphoPools.push(pool)
        calls1.push(pool.asset())
        calls1.push(pool.totalAssets())
        calls1.push(pool.totalSupply())
        calls1.push(pool.fee())
        calls1.push(pool.withdrawQueueLength())
        users.forEach((addr) => {
          calls1.push(pool.balanceOf(addr))
        })
      })
    }
    if (conf.spark) {
      conf.spark.pools.forEach((address) => {
        const pool = new Contract(address, sparkVaultAbi)
        calls1.push(pool.asset())
        calls1.push(pool.totalAssets())
        calls1.push(pool.totalSupply())
        users.forEach((addr) => {
          calls1.push(pool.balanceOf(addr))
        })
      })
    }
    console.log('calling call1', chain)

    const call1Data = await callWithTimeout(chain, calls1, currentBlockNumber)
    console.log('calling call1 success', chain)

    // === Build call2: collaterals, compound borrow rates, AAVE reserve data ===
    const collateralMap: { [c: string]: string[] } = {}
    const underlyings: { [u: string]: true } = {}
    const borrowableToUnderlying: { [b: string]: string } = {}
    const calls2: Call[] = []
    conf.borrowables.forEach((b, i) => {
      borrowableToUnderlying[b] = call1Data[callsPerBor * i + 1]
      underlyings[call1Data[callsPerBor * i + 1]] = true
      const collateral = call1Data[callsPerBor * i]
      if (collateralMap[collateral]) {
        collateralMap[collateral].push(b)
        return
      }
      collateralMap[collateral] = [b]

      const cc = new Contract(collateral, collateralAbi)
      calls2.push(cc.borrowable0(), cc.borrowable1(), cc.underlying(), cc.exchangeRate())
      users.forEach((u) => {
        calls2.push(cc.balanceOf(u))
      })
    })

    const stakingPoolCursor = 0

    const borrowableCallCount =
      conf.borrowables.length * callsPerBor + Object.keys(conf.staking).length * callsPerStakingPool
    conf.compoundBorrowings.forEach((address, i) => {
      const baseAsset = call1Data[borrowableCallCount + i * 5] as string
      if (!conf.assets[baseAsset]) {
        throw new Error(`unknown base asset ${baseAsset} in compound borrowing ${address}`)
      }
      const numAssets = Number(call1Data[borrowableCallCount + i * 5 + 1])
      const utilization = call1Data[borrowableCallCount + i * 5 + 2]
      const totalBorrow = call1Data[borrowableCallCount + i * 5 + 3]
      const rewardRate = call1Data[borrowableCallCount + i * 5 + 4]
      if (rewardRate > 0) console.log('compound reward rate', rewardRate, totalBorrow)
      ctx.compoundBorrowingInfo[chain][address] = {
        baseAsset,
        rewards: {},
        spendings: {},
        borrowed: {},
        supplied: {},
        numAssets,
        borrowRate: 0n,
        collaterals: {},
        rewardRate,
        totalBorrow,
        positions: {},
        liquidationRatio: {},
        asset: conf.assets[baseAsset],
        assetPrice: getAssetPrice(conf.assets[baseAsset]),
        collateralToAsset: {},
      }
      calls2.push(compoundBorrowings[i].getBorrowRate(utilization))
      users.forEach((u) => {
        calls2.push(compoundBorrowings[i].borrowBalanceOf(u))
      })
      for (let j = 0; j < numAssets; j++) {
        calls2.push(compoundBorrowings[i].getAssetInfo(j))
      }
    })

    let assetAddressesOnAAVE: string[] = []

    if (conf.aaveLendingPool) {
      assetAddressesOnAAVE = call1Data.pop().filter((x: string) => conf.assets[x])
      assetAddressesOnAAVE.forEach((reserve: string) => {
        calls2.push(aaveLendingPool!.getReserveData(reserve))
      })
      calls2.push(aaveLendingPool!.getEModeCategoryData(1)) // ETH correlated
      users.forEach((u) => {
        calls2.push(aaveLendingPool!.getUserEMode(u))
      })
    }

    console.log('calling call2', chain)

    const call2Data = await callWithTimeout(chain, calls2, currentBlockNumber)
    console.log('calling call2: success', chain)

    // === Build call3: second borrowable underlyings, vault historical state ===
    const calls3: Call[] = []
    const vaultOrLPByBor: { [b: string]: string } = {}
    const stableByBor: { [b: string]: boolean } = {}
    const exchangeRateByCollateral: { [b: string]: bigint } = {}
    const collateralToBorrowables: { [c: string]: string[] } = {}
    const balanceByCollateralByUser: { [c: string]: { [user: string]: bigint } } = {}
    const callsPerCol = 4 + users.length
    const secondBorrowables: string[] = []
    Object.entries(collateralMap).forEach(([col, bors], i) => {
      if (!balanceByCollateralByUser[col]) balanceByCollateralByUser[col] = {}
      const b0 = call2Data[i * callsPerCol]
      const b1 = call2Data[i * callsPerCol + 1]
      collateralToBorrowables[col] = [b0, b1]
      const underlying = call2Data[i * callsPerCol + 2]
      bors.forEach((b, j) => {
        const secondBor = b === b0 ? b1 : b0
        const borrowable2 = new Contract(secondBor, borrowableAbi)

        secondBorrowables.push(secondBor)

        calls3.push(borrowable2.underlying())
        if (i === 0 && j === 0) {
          calls3.push(borrowable2.getBlockTimestamp())
        }
        vaultOrLPByBor[b] = underlying
      })
      const vault = new Contract(underlying, vaultAbi)
      calls3.push(vault.stable())
      calls3.push(vault.reinvest())
      calls3.push(vault.exchangeRate())
      calls3.push(vault.totalBalance())
      calls3.push(vault.underlying())
      exchangeRateByCollateral[col] = call2Data[i * callsPerCol + 3]
      users.forEach((u, j) => {
        balanceByCollateralByUser[col][u] = call2Data[i * callsPerCol + 4 + j]
      })
    })

    const lendingProtocolCalls: Call[] = []

    // === Parse compound call2 data ===
    let skipCount = Object.keys(collateralMap).length * callsPerCol
    skipCount = parseCompoundCall2Data(
      ctx,
      chain,
      conf,
      users,
      call2Data,
      skipCount,
      compoundBorrowings,
      lendingProtocolCalls,
    )

    // === Parse AAVE call2 data ===
    const userEMode: { [user: string]: number } = {}
    const eModeLiqThreshold: { [eMode: number]: number } = {}
    if (conf.aaveLendingPool) {
      assetAddressesOnAAVE.forEach((reserve: string) => {
        ctx.aaveReserveData[chain][reserve] = call2Data[skipCount++]
      })
      const eModeCategoryData = call2Data[skipCount++]
      eModeLiqThreshold[1] = Number(eModeCategoryData[1])
      users.forEach((u) => {
        userEMode[u] = Number(call2Data[skipCount++])
      })
    }

    assetAddressesOnAAVE.forEach((reserve: string) => {
      const aToken = new Contract(ctx.aaveReserveData[chain][reserve][8], aTokenAbi)
      lendingProtocolCalls.push(aToken.totalSupply())
      const vdToken = new Contract(ctx.aaveReserveData[chain][reserve][10], aTokenAbi)
      lendingProtocolCalls.push(vdToken.totalSupply())
      const interestRateModel = new Contract(ctx.aaveReserveData[chain][reserve][11], interestRateModelAbi)
      lendingProtocolCalls.push(interestRateModel.getOptimalUsageRatio(reserve))
      users.forEach((u) => {
        lendingProtocolCalls.push(aToken.balanceOf(u), vdToken.balanceOf(u))
      })
    })

    // === Parse morpho call1 data ===
    const callIndex = borrowableCallCount + conf.compoundBorrowings.length * 5 + (conf.aaveLendingPool ? 1 : 0)
    let nextCallIndex = callIndex
    if (conf.morpho) {
      nextCallIndex = parseMorphoCall1Data(ctx, chain, conf, users, call1Data, calls1, calls3, callIndex)
    }

    // === Parse spark call1 data ===
    if (conf.spark) {
      parseSparkCall1Data(ctx, chain, conf, users, call1Data, calls1, calls3, nextCallIndex)
    }

    console.log('calling call3', chain)
    const call3Data = await tryWithTimeout(
      chain,
      calls3,
      pastBlockNumber,
      undefined,
      '0xcA11bde05977b3631167028862bE2a173976CA11',
    )

    console.log('calling call3 success', chain)

    // === Parse call3: vault historical state ===
    const pastVaultStateByBorrowable: {
      [b: string]: { timestamp: number; exchangeRate: bigint; totalBalance: bigint }
    } = {}

    const calls4: Call[] = []

    let cursor = 0
    let sbCursor = 0
    let timestamp = 0
    const vaultByCollateral: { [vault: string]: string } = {}
    const collateralByBorrowable: { [vault: string]: string } = {}
    Object.entries(collateralMap).forEach(([col, bors]) => {
      bors.forEach((b) => {
        collateralByBorrowable[b] = col
        // second borrowable underlying
        const underlyingAsset = call3Data[cursor++]
        borrowableToUnderlying[secondBorrowables[sbCursor++]] = underlyingAsset
        if (!timestamp) {
          timestamp = Number(call3Data[cursor++])
        }
        calls4.push(new Contract(underlyingAsset, borrowableAbi).symbol())
      })
      vaultByCollateral[col] = vaultOrLPByBor[bors[0]]
      const vault = new Contract(vaultOrLPByBor[bors[0]], vaultAbi)
      console.log({ vault: vaultOrLPByBor[bors[0]] })
      calls4.push(vault.reinvest())
      calls4.push(vault.exchangeRate())
      calls4.push(vault.totalBalance())

      const stable = call3Data[cursor++]
      cursor++ // reinvest
      const exchangeRate = call3Data[cursor++] ?? ONE
      const totalBalance = call3Data[cursor++] ?? ONE
      const lp = call3Data[cursor++] ?? vaultByCollateral[col]
      const lpc = new Contract(lp, vaultAbi)
      calls4.push(lpc.getReserves())
      calls4.push(lpc.totalSupply())
      bors.forEach((b) => {
        pastVaultStateByBorrowable[b] = {
          timestamp,
          exchangeRate,
          totalBalance,
        }
        stableByBor[b] = stable
      })
    })

    // === Process morpho rewards and build morpho pools ===
    if (conf.morpho) {
      cursor = await processMorphoRewardsAndPools(
        ctx,
        chain,
        conf,
        call3Data,
        cursor,
        blockTimestamp,
        timestamp,
        currentBlockNumber,
        pastBlockNumber,
      )
    }

    // === Process spark pools ===
    if (conf.spark) {
      cursor = await processSparkPools(
        ctx,
        chain,
        conf,
        call3Data,
        cursor,
        blockTimestamp,
        timestamp,
        currentBlockNumber,
        pastBlockNumber,
      )
    }

    users.forEach((u) => {
      calls4.push(getCurrentEthCallProvider(chain).getEthBalance(u))
    })

    Object.keys(underlyings).forEach((a) => {
      users.forEach((u) => {
        calls4.push(new Contract(a, borrowableAbi).balanceOf(u))
      })
    })

    console.log('calling call4', chain)
    console.log(calls4)
    const dataFromCall4 = await tryWithTimeout(
      chain,
      [...calls4, ...lendingProtocolCalls],
      currentBlockNumber,
      undefined,
      '0xcA11bde05977b3631167028862bE2a173976CA11',
    )

    // === Parse call4: symbols, vault reinvest data, LP reserves ===
    const symbolByBorrowable: { [b: string]: string } = {}
    const vaultExchangeRateAfterReinvestByVault: { [b: string]: bigint } = {}
    const vaultBalanceAfterReinvestByVault: { [b: string]: bigint } = {}
    const reservesByVault: { [b: string]: [bigint, bigint] } = {}
    const lpSupplyByVault: { [b: string]: bigint } = {}
    cursor = 0
    sbCursor = 0
    Object.entries(collateralMap).forEach(([col, bors]) => {
      bors.forEach((_) => {
        symbolByBorrowable[secondBorrowables[sbCursor++]] = dataFromCall4[cursor++]
        console.log('second borrowable symbol', secondBorrowables[sbCursor - 1], dataFromCall4[cursor - 1])
      })
      cursor++ // reinvest
      const vaultExchangeRateAfterReinvest = dataFromCall4[cursor++] ?? ONE
      const vaultBalanceAfterReinvest = dataFromCall4[cursor++] ?? ONE
      const { 0: reserve0, 1: reserve1 } = dataFromCall4[cursor++]
      const lpSupply = dataFromCall4[cursor++]
      if (!vaultExchangeRateAfterReinvestByVault[vaultByCollateral[col]])
        vaultExchangeRateAfterReinvestByVault[vaultByCollateral[col]] = vaultExchangeRateAfterReinvest
      if (!vaultBalanceAfterReinvestByVault[vaultByCollateral[col]])
        vaultBalanceAfterReinvestByVault[vaultByCollateral[col]] = vaultBalanceAfterReinvest
      if (!reservesByVault[vaultByCollateral[col]]) reservesByVault[vaultByCollateral[col]] = [reserve0, reserve1]
      if (!lpSupplyByVault[vaultByCollateral[col]]) lpSupplyByVault[vaultByCollateral[col]] = lpSupply
    })

    console.log('calling call4 success')
    console.log(vaultBalanceAfterReinvestByVault)

    // === Process idle balances ===
    const idleBalances = dataFromCall4.slice(cursor)

    for (let i = 0; i <= Object.keys(underlyings).length; i++) {
      if (i !== 0 && !conf.assets[Object.keys(underlyings)[i - 1]]) {
        throw new Error(`${chain} unknown underlying ${Object.keys(underlyings)[i - 1]}`)
      }
      let asset

      if (i === 0) {
        switch (chain) {
          case Chains.SONIC:
            asset = ASSETS.SONIC
            break
          case Chains.AVAX:
            asset = ASSETS.AVAX
            break
          default:
            asset = ASSETS.ETH
            break
        }
      } else {
        asset = conf.assets[Object.keys(underlyings)[i - 1]]
      }
      const div = getDiv(asset)
      let j = 0
      for (const user of users) {
        const bn = idleBalances[i * users.length + j]
        accumulateDeposit(ctx.idleBalancesByAsset, [asset], bn, div, asset)
        accumulateDeposit(ctx.idleBalancesByChain, [chain, asset], bn, div, asset)
        if (bn > 0n) {
          accumulateDeposit(ctx.idleBalancesByChainByAssetByUser, [chain, asset, user], bn, div, asset)
          const { usd } = toDeposit(bn, div, asset)
          accumulateDeposit(ctx.idleBalancesByAssetByUser, [asset, user], bn, div, asset)
          accumulateUsd(ctx.idleBalancesByUser, [user], usd)
          accumulateUsd(ctx.idleBalancesByChainByUser, [chain, user], usd)
        }
        j++
      }
    }

    // === Process compound collateral and positions ===
    skipCount = calls4.length
    skipCount = processCompoundCollateral(ctx, chain, conf, users, dataFromCall4, skipCount)
    buildCompoundPositions(ctx, chain)

    // === Process AAVE balances and positions ===
    processAaveBalances(
      ctx,
      chain,
      conf,
      users,
      assetAddressesOnAAVE,
      dataFromCall4,
      skipCount,
      userEMode,
      eModeLiqThreshold,
    )

    // === Process Impermax/Tarot borrowables ===
    const aprByVault = processBorrowables(
      ctx,
      chain,
      conf,
      users,
      call1Data,
      callsPerBor,
      callsPerStakingPool,
      stakingPoolCursor,
      blockTimestamp,
      pastVaultStateByBorrowable,
      vaultOrLPByBor,
      stableByBor,
      collateralByBorrowable,
      collateralToBorrowables,
      symbolByBorrowable,
      vaultExchangeRateAfterReinvestByVault,
      vaultBalanceAfterReinvestByVault,
    )

    // === Process collateral positions (LP positions) ===
    processCollateralPositions(
      ctx,
      conf,
      users,
      collateralMap,
      balanceByCollateralByUser,
      exchangeRateByCollateral,
      vaultByCollateral,
      vaultExchangeRateAfterReinvestByVault,
      borrowableToUnderlying,
      collateralToBorrowables,
      symbolByBorrowable,
      reservesByVault,
      lpSupplyByVault,
      aprByVault,
    )

    // === Build AAVE pool entries ===
    buildAavePools(ctx, chain, conf, assetAddressesOnAAVE)
  }

  await Promise.all(chains.map((chain) => callChain(chain).then(() => onChainDone?.(chain))))

  // === Post-processing: aggregate stats by chain ===
  for (const c in Chains) {
    for (const a in ASSETS) {
      const div = getDiv(a as ASSETS)
      const aca = ctx.cumulativeValuesByChains[c][a]
      if (aca) {
        aca.currentAPR =
          aca.newUserSupplied === 0 ? 0 : Number(((aca.oldDailyEarnings * 36500) / aca.newUserSupplied).toFixed(2))
        aca.maxAPR =
          aca.newUserSupplied === 0 ? 0 : Number(((aca.maxDailyEarnings * 36500) / aca.newUserSupplied).toFixed(2))
        aca.oldDailyEarningsUsd = Number(((aca.oldDailyEarnings * getAssetPrice(a as ASSETS)) / div).toFixed(2))
        aca.maxDailyEarningsUsd = Number(((aca.maxDailyEarnings * getAssetPrice(a as ASSETS)) / div).toFixed(2))
        aca.newUserSuppliedUsd = Number(((aca.newUserSupplied * getAssetPrice(a as ASSETS)) / div).toFixed(2))
        aca.oldDailyEarnings = Number((aca.oldDailyEarnings / div).toFixed(4))
        aca.newUserSupplied = Number((aca.newUserSupplied / div).toFixed(4))
        aca.maxDailyEarnings = Number((aca.maxDailyEarnings / div).toFixed(4))
        ctx.chainAggregatedStats[c].newUserSuppliedUsd = Number(
          (ctx.chainAggregatedStats[c].newUserSuppliedUsd + aca.newUserSuppliedUsd).toFixed(2),
        )
        ctx.chainAggregatedStats[c].oldDailyEarningsUsd = Number(
          (ctx.chainAggregatedStats[c].oldDailyEarningsUsd + aca.oldDailyEarningsUsd).toFixed(2),
        )
        ctx.chainAggregatedStats[c].maxDailyEarningsUsd = Number(
          (ctx.chainAggregatedStats[c].maxDailyEarningsUsd + aca.maxDailyEarningsUsd).toFixed(2),
        )
        ctx.chainAggregatedStats[c].maxAPR =
          ctx.chainAggregatedStats[c].newUserSuppliedUsd === 0
            ? 0
            : Number(
                (
                  (ctx.chainAggregatedStats[c].maxDailyEarningsUsd * 36500) /
                  ctx.chainAggregatedStats[c].newUserSuppliedUsd
                ).toFixed(2),
              )
        ctx.chainAggregatedStats[c].currentAPR =
          ctx.chainAggregatedStats[c].newUserSuppliedUsd === 0
            ? 0
            : Number(
                (
                  (ctx.chainAggregatedStats[c].oldDailyEarningsUsd * 36500) /
                  ctx.chainAggregatedStats[c].newUserSuppliedUsd
                ).toFixed(2),
              )
        if (aca.newUserSuppliedUsd + (ctx.idleBalancesByChain[c]?.[a]?.usd ?? 0) === 0) {
          delete ctx.cumulativeValuesByChains[c][a]
        }
      }
    }
  }

  Object.entries(ctx.idleBalancesByChain).forEach(([chain, props]) => {
    ctx.chainAggregatedStats[chain].usd = Number(
      Object.values(props)
        .reduce((acc, { usd }) => acc + usd, 0)
        .toFixed(2),
    )
  })

  const sortedChains = Object.keys(ctx.cumulativeValuesByChains).sort((a, b) => {
    return ctx.chainAggregatedStats[b].newUserSuppliedUsd - ctx.chainAggregatedStats[a].newUserSuppliedUsd
  })

  sortedChains.forEach((chain, i) => {
    const val = ctx.cumulativeValuesByChains[chain]
    const sortedAssets = Object.keys(val).sort((assetA, assetB) => {
      return (
        val[assetB].newUserSuppliedUsd +
        (ctx.idleBalancesByChain[chain][assetB] ? ctx.idleBalancesByChain[chain][assetB].usd : 0) -
        (val[assetA].newUserSuppliedUsd +
          (ctx.idleBalancesByChain[chain][assetA] ? ctx.idleBalancesByChain[chain][assetA].usd : 0))
      )
    })
    sortedAssets.forEach((x, j) => {
      if (j === 0) return
      const val2 = val[x]
      delete val[x]
      val[x] = val2
    })
    if (i === 0) return
    delete ctx.cumulativeValuesByChains[chain]
    ctx.cumulativeValuesByChains[chain] = val
  })

  console.log('compoundBorrowingReward.usd', ctx.compoundBorrowingReward.usd)

  console.log('supplied as collateral', ctx.suppliedAsCollateral)
  console.log('earnings as collateral', ctx.earningsAsCollateral)

  // === Aggregate stats by asset ===
  let totalDeposited = 0
  let oldTotalEarnings = ctx.compoundBorrowingReward.usd / 365
  let newTotalEarnings = ctx.compoundBorrowingReward.usd / 365
  let maxTotalEarnings = ctx.compoundBorrowingReward.usd / 365
  for (const a in ASSETS) {
    const price = getAssetPrice(a as ASSETS)
    const div = getDiv(a as ASSETS)
    const ca = ctx.cumulativeValuesByAsset[a]
    if (ca) {
      if (ctx.aaveVDBalancesByAsset[a]) {
        totalDeposited -= Number(ctx.aaveVDBalancesByAsset[a].usd)
        if (ctx.aaveVDBalancesByAsset[a].usd > 0) {
          console.log('aave debt', a, ctx.aaveVDBalancesByAsset[a])
        }
      }
      if (ctx.compoundDebtByAsset[a]) {
        totalDeposited -= Number(ctx.compoundDebtByAsset[a].usd)
        if (ctx.compoundDebtByAsset[a].usd > 0) {
          console.log('compound debt', a, ctx.compoundDebtByAsset[a])
        }
      }
      if (ctx.aaveVDSpendingsByAsset[a]) {
        oldTotalEarnings -= Number(ctx.aaveVDSpendingsByAsset[a].usd) / 365
        newTotalEarnings -= Number(ctx.aaveVDSpendingsByAsset[a].usd) / 365
        maxTotalEarnings -= Number(ctx.aaveVDSpendingsByAsset[a].usd) / 365
      }
      if (ctx.compoundSpendingsByAsset[a]) {
        if (ctx.compoundSpendingsByAsset[a].usd > 0) {
          console.log('compound spendings', a, Number(ctx.compoundSpendingsByAsset[a].usd) / 365)
        }
        oldTotalEarnings -= Number(ctx.compoundSpendingsByAsset[a].usd) / 365
        newTotalEarnings -= Number(ctx.compoundSpendingsByAsset[a].usd) / 365
        maxTotalEarnings -= Number(ctx.compoundSpendingsByAsset[a].usd) / 365
      }
      const [depUsd, oldEarnings, newEarinings, maxEarnings] = formatStats(ca, price, div)
      totalDeposited += Number(depUsd)
      oldTotalEarnings += Number(oldEarnings)
      newTotalEarnings += Number(newEarinings)
      maxTotalEarnings += Number(maxEarnings)
      ca.currentAPR =
        ca.newUserSupplied === 0 ? 0 : Number(((ca.oldDailyEarnings * 36500) / ca.newUserSupplied).toFixed(2))
      ca.maxAPR = ca.newUserSupplied === 0 ? 0 : Number(((ca.maxDailyEarnings * 36500) / ca.newUserSupplied).toFixed(2))
      ca.oldDailyEarningsUsd = Number(((ca.oldDailyEarnings * getAssetPrice(a as ASSETS)) / div).toFixed(2))
      ca.maxDailyEarningsUsd = Number(((ca.maxDailyEarnings * getAssetPrice(a as ASSETS)) / div).toFixed(2))
      ca.newUserSuppliedUsd = Number(((ca.newUserSupplied * getAssetPrice(a as ASSETS)) / div).toFixed(2))
      ca.oldDailyEarnings = Number((ca.oldDailyEarnings / div).toFixed(4))
      ca.newUserSupplied = Number((ca.newUserSupplied / div).toFixed(4))
      ca.maxDailyEarnings = Number((ca.maxDailyEarnings / div).toFixed(4))
      if (ctx.cumulativeValuesByAsset[a].newUserSuppliedUsd + ctx.idleBalancesByAsset[a].usd < 1) {
        delete ctx.cumulativeValuesByAsset[a]
      }
    }
  }

  // === Sort and filter ===
  const sortedAssets = Object.keys(ctx.cumulativeValuesByAsset).sort((a, b) => {
    return ctx.cumulativeValuesByAsset[b].newUserSuppliedUsd - ctx.cumulativeValuesByAsset[a].newUserSuppliedUsd
  })

  sortedAssets.forEach((x, i) => {
    if (i === 0) return
    const val = ctx.cumulativeValuesByAsset[x]
    delete ctx.cumulativeValuesByAsset[x]
    ctx.cumulativeValuesByAsset[x] = val
  })

  sortByUserSimple(ctx.idleBalancesByUser)
  sortByUserSimple(ctx.suppliedByUser)

  const sortedIds = Object.keys(ctx.aavePositions).sort((a, b) => {
    return ctx.aavePositions[b].collateralTotalUsd - ctx.aavePositions[a].collateralTotalUsd
  })
  sortedIds.forEach((x, i) => {
    if (i === 0) return
    const val = ctx.aavePositions[x]
    delete ctx.aavePositions[x]
    ctx.aavePositions[x] = val
  })
  ;[ctx.idleBalancesByAssetByUser, ctx.suppliedByAssetByUser].forEach((userMap) => {
    Object.entries(userMap).forEach(([_, byUser]) => {
      sortByUserDeposit(byUser)
    })
  })
  ;[ctx.idleBalancesByChainByAssetByUser, ctx.suppliedByChainByAssetByUser].forEach((userMap) => {
    Object.values(userMap).forEach((idleByAssetByUser) => {
      Object.values(idleByAssetByUser).forEach(sortByUserDeposit)
    })
  })
  ;[ctx.idleBalancesByChainByUser, ctx.suppliedByChainByUser].forEach((userMap) => {
    Object.values(userMap).forEach(sortByUserSimple)
  })

  Object.values(ctx.suppliedByChainByBorrowableByUser).forEach((chau) => {
    Object.values(chau).forEach(sortByUserDeposit)
  })

  const maxAPR = totalDeposited > 0 ? ((maxTotalEarnings * 36500) / totalDeposited).toFixed(2) : '0'

  const poolChains: { [chain: string]: true } = {}
  const poolAssets: { [chain: string]: true } = {}

  const goodPools = ctx.pools
    .filter((x) => {
      const good =
        x.suppliedUsd > 1 ||
        (x.stakingAPR + x.aprNew > POOL_FILTER_APR_THRESHOLD &&
          x.availableToDepositUsd > POOL_FILTER_CAPACITY_THRESHOLD &&
          x.tvlUsd > POOL_FILTER_MIN_TVL)
      if (good) {
        poolChains[x.chain] = true
        poolAssets[x.asset] = true
      }
      return good
    })
    .sort((a, b) => {
      return b.aprNew + b.stakingAPR - (a.aprNew + a.stakingAPR)
    })

  const currentAPR = totalDeposited > 0 ? ((oldTotalEarnings * 36500) / totalDeposited).toFixed(2) : '0'

  const usd = Object.values(ctx.idleBalancesByAsset).reduce((acc, curr) => {
    return acc + curr.usd
  }, 0)

  const res = {
    goodPools,
    idleBalancesByAsset: ctx.idleBalancesByAsset,
    idleBalancesByChain: ctx.idleBalancesByChain,
    idleBalancesByChainByUser: ctx.idleBalancesByChainByUser,
    idleBalancesByChainByAssetByUser: ctx.idleBalancesByChainByAssetByUser,
    idleBalancesByAssetByUser: ctx.idleBalancesByAssetByUser,
    idleBalancesByUser: ctx.idleBalancesByUser,
    cumulativeValuesByChains: ctx.cumulativeValuesByChains,
    cumulativeValuesByAsset: ctx.cumulativeValuesByAsset,
    suppliedByUser: ctx.suppliedByUser,
    suppliedByAssetByUser: ctx.suppliedByAssetByUser,
    suppliedByChainByUser: ctx.suppliedByChainByUser,
    suppliedByChainByAssetByUser: ctx.suppliedByChainByAssetByUser,
    suppliedByChainByBorrowableByUser: ctx.suppliedByChainByBorrowableByUser,
    compoundBorrowingRewardByBorrowedAsset: ctx.compoundBorrowingRewardByBorrowedAsset,
    morphoRewardsByAsset: ctx.morphoRewardsByAsset,
    morphoRewardsByChainByAsset: ctx.morphoRewardsByChainByAsset,
    morphoRewardsByChain: ctx.morphoRewardsByChain,
    morphoRewards:
      ctx.morphoRewardTotalUsd > 0
        ? {
            token: ctx.morphoRewardToken,
            amount: Number(ctx.morphoRewardTotalAmount.toFixed(4)),
            usd: Number(ctx.morphoRewardTotalUsd.toFixed(2)),
            apr: Number(((ctx.morphoRewardTotalUsd * 36500) / totalDeposited).toFixed(2)),
          }
        : null,
    sparkRewardsByAsset: ctx.sparkRewardsByAsset,
    sparkRewardsByChainByAsset: ctx.sparkRewardsByChainByAsset,
    sparkRewardsByChain: ctx.sparkRewardsByChain,
    sparkRewards:
      ctx.sparkRewardTotalUsd > 0
        ? {
            token: ctx.sparkRewardToken,
            amount: Number(ctx.sparkRewardTotalAmount.toFixed(4)),
            usd: Number(ctx.sparkRewardTotalUsd.toFixed(2)),
            apr: Number(((ctx.sparkRewardTotalUsd * 36500) / totalDeposited).toFixed(2)),
          }
        : null,
    totalDeposited: totalDeposited.toFixed(2),
    oldTotalEarnings: oldTotalEarnings.toFixed(2),
    newTotalEarnings: newTotalEarnings.toFixed(2),
    maxTotalEarnings: maxTotalEarnings.toFixed(2),
    maxAPR,
    currentAPR,
    aavePositions: ctx.aavePositions,
    chainAggregatedStats: ctx.chainAggregatedStats,
    poolAssets: Object.keys(poolAssets),
    poolChains: Object.keys(poolChains),
    usd: usd.toFixed(2),
    users,
    compoundBorrowingInfo: ctx.compoundBorrowingInfo,
  }

  ;(BigInt.prototype as any).toJSON = function () {
    return this.toString()
  }

  return res
}
