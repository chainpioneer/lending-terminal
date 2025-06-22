import {Call, Contract} from 'ethcall'

import borrowableAbi from '../../abi/borrowable.json' assert {type: 'json'}
import aTokenAbi from '../../abi/AToken.json' assert {type: 'json'}
import stakingPoolAbi from '../../abi/stakingPool.json' assert {type: 'json'}
import aaveLendingPoolAbi from '../../abi/AAVELendingPool.json' assert {type: 'json'}
import compoundBorrowingAbi from '../../abi/CompoundBorrowing.json' assert {type: 'json'}
import interestRateModelAbi from '../../abi/AAVEInterestRateModel.json' assert {type: 'json'}
import vaultAbi from '../../abi/vault.json' assert {type: 'json'}
import collateralAbi from '../../abi/collateral.json' assert {type: 'json'}
import {ASSETS, CHAIN_CONF, Chains, getDiv} from '../constants/constants'
import {callWithTimeout, getCurrentEthCallProvider, tryWithTimeout, web3EthCall} from '../provider/provider'
import ONE from '../utils/ONE'
import {getAssetPrice, waitForPrices} from "./assetPrices";
import {Deposit, populate, populateSimple, toDeposit} from "../utils/depositUtils";

type AssetStats = {
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

type ChainStats = {
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

const aprThreshold = 8
const capacityThreshold = -1
const minTVL = 1_000

export default async function load(users: string[]) {

  await waitForPrices()
  const cumulativeValuesByChains: { [chain: string]: { [asset: string]: AssetStats } } = {}
  const chainAggregatedStats: { [chain: string]: ChainStats } = {}
  const cumulativeValuesByAsset: { [asset: string]: AssetStats } = {}
  const idleBalancesByAsset: { [asset: string]: Deposit } = {}
  const aaveABalancesByAsset: { [asset: string]: Deposit } = {}
  const compoundCollateralByAsset: { [asset: string]: Deposit } = {}
  const compoundDebtByAsset: { [asset: string]: Deposit } = {}
  const compoundBorrowingReward: Deposit = { amount: 0, bn: 0n, usd: 0 }
  const compoundBorrowingRewardByBorrowedAsset: { [asset: string] : Deposit } = {}
  const aaveAEarningsByAsset: { [asset: string]: Deposit } = {}
  const compoundSpendingsByAsset: { [asset: string]: Deposit } = {}
  const aaveVDSpendingsByAsset: { [asset: string]: Deposit } = {}
  const aaveVDBalancesByAsset: { [asset: string]: Deposit } = {}
  const idleBalancesByChain: { [chain: string]: { [asset: string]:  Deposit } } = {}
  const aaveABalancesByChainByAsset: { [chain: string]: { [asset: string]: Deposit } } = {}
  const aaveABalancesByChainByAssetAddress: { [chain: string]: { [address: string]: Deposit } } = {}
  const aaveVDBalancesByChainByAsset: { [asset: string]: { [asset: string]: Deposit } } = {}
  // const aaveAEarningsByChainByAsset: { [asset: string]: { [asset: string]: Deposit } } = {}
  // const aaveVDSpendingsByChainByAsset: { [asset: string]: { [asset: string]: Deposit } } = {}

  const idleBalancesByUser: { [user: string]: number } = {}
  const idleBalancesByAssetByUser: { [asset: string]:  { [user: string]: Deposit } } = {}
  const idleBalancesByChainByUser: { [chain: string]: { [user: string]: number } } = {}
  const idleBalancesByChainByAssetByUser: { [chain: string]: { [asset: string]:  { [user: string]: Deposit } } } = {}

  const suppliedByUser: { [user: string]: number } = {}
  let suppliedAsCollateral: number = 0
  let earningsAsCollateral: number = 0
  const suppliedByAssetByUser: { [asset: string]: { [user: string]: Deposit } } = {}
  const suppliedByChainByUser: { [chain: string]: { [user: string]: number } } = {}
  const suppliedByChainByAssetByUser: { [chain: string]: { [asset: string]: { [user: string]: Deposit } } } = {}
  const suppliedByChainByBorrowableByUser: { [chain: string]: { [borrowable: string]: { [user: string]: Deposit } } } = {}

  const aTokenInfo: { [asset: string]: { [aToken: string]: { supply: Deposit, borrow: Deposit, kinkUtilizationRatio: bigint } } } = {}
  const compoundBorrowingInfo: { [chain: string]: { [borrowing: string]:
          {
            asset: ASSETS,
            assetPrice: number,
            baseAsset: string,
            borrowed: { [user: string]: Deposit },
            rewards: { [user: string]: Deposit },
            spendings: { [user: string]: Deposit },
            supplied: { [asset: string]: Deposit },
            numAssets: number,
            borrowRate: bigint,
            rewardRate: bigint,
            totalBorrow: bigint,
            collaterals: { [collateral: string]: { [user: string]: Deposit } },
            collateralToAsset: { [collateral: string]: ASSETS },
            liquidationRatio: { [collateral: string]: bigint },
            positions: {
              [user: string]: { healthFactor: number, liquidationPrice: number, address: string, collateralTotalUsd: number, apr: number }
            }
          } } }
      = {}

  const aavePositions: {
    [userChain: string] : {
        healthFactor: string | number, collateralTotalUsd: number, collateralizationUsd: number, borrowedTotalUsd: number, apr: number, earnings: number, spendings: number, collaterals: { [asset: string]: Deposit }, borrows: { [asset: string]: Deposit }
      }
  } = {}

  const aaveReserveData: any = {}

  const pools: Pool[] = []

  const chains = Object.keys(CHAIN_CONF) as Chains[]

  async function callChain(chain: Chains) {
    aTokenInfo[chain] = {}
    aaveReserveData[chain] = {}
    cumulativeValuesByChains[chain] = {}
    chainAggregatedStats[chain] = {
      newUserSuppliedUsd: 0,
      currentAPR: 0,
      oldDailyEarningsUsd: 0,
      usd: 0,
      maxAPR: 0,
      maxDailyEarningsUsd: 0
    }
    idleBalancesByChain[chain] = {}
    compoundBorrowingInfo[chain] = {}
    idleBalancesByChainByAssetByUser[chain] = {}
    aaveABalancesByChainByAsset[chain] = {}
    aaveABalancesByChainByAssetAddress[chain] = {}
    aaveVDBalancesByChainByAsset[chain] = {}
    const blockStruct = await web3EthCall(chain, 'getBlock', ['latest', false])
    const currentBlockNumber = Number(blockStruct.number)
    const pastBlockNumber = currentBlockNumber - (chain == Chains.SONIC ? 1_000 : 100)
    const blockTimestamp = Number(blockStruct.timestamp)
    const conf = CHAIN_CONF[chain as Chains]

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
    Object.values(conf.staking).forEach(({pool, rewardToken}, i) => {
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
    conf.compoundBorrowings.forEach(address => {
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
    console.log("calling call1", chain)

    const call1Data = await callWithTimeout(chain, calls1, currentBlockNumber)
    console.log("calling call1 success", chain)

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
      } else {
        collateralMap[collateral] = [b]
      }
      const cc = new Contract(collateral, collateralAbi)
      calls2.push(cc.borrowable0(), cc.borrowable1(), cc.underlying(), cc.exchangeRate())
      users.forEach(u => {
        calls2.push(cc.balanceOf(u))
      })
    })

    let stakingPoolCursor = 0


    let skipCount = conf.borrowables.length * callsPerBor + Object.keys(conf.staking).length * callsPerStakingPool
    conf.compoundBorrowings.forEach((address, i) => {
      const baseAsset = call1Data[skipCount + i * 5] as string
      if (!conf.assets[baseAsset]) {
        throw new Error(`unknown base asset ${baseAsset} in compound borrowing ${address}`)
      }
      const numAssets = Number(call1Data[skipCount + i * 5 + 1])
      const utilization = call1Data[skipCount + i * 5 + 2]
      const totalBorrow = call1Data[skipCount + i * 5 + 3]
      const rewardRate = call1Data[skipCount + i * 5 + 4]
      if (rewardRate > 0)
      console.log('compound reward rate', rewardRate, totalBorrow)
      compoundBorrowingInfo[chain][address] = { baseAsset, rewards: {}, spendings: {}, borrowed: {}, supplied: {}, numAssets, borrowRate: 0n, collaterals: { }, rewardRate, totalBorrow, positions: {}, liquidationRatio: {}, asset: conf.assets[baseAsset], assetPrice: getAssetPrice(conf.assets[baseAsset]), collateralToAsset: {} }
      calls2.push(compoundBorrowings[i].getBorrowRate(utilization))
      users.forEach(u => {
        calls2.push(compoundBorrowings[i].borrowBalanceOf(u))
      })
      for (let j = 0; j < numAssets; j++) {
        calls2.push(compoundBorrowings[i].getAssetInfo(j))
      }
    })

    let assetAddressesOnAAVE = []

    if (conf.aaveLendingPool) {
      assetAddressesOnAAVE = call1Data.pop().filter((x: string) => conf.assets[x])
      assetAddressesOnAAVE.forEach((reserve: string) => {
        calls2.push(aaveLendingPool!.getReserveData(reserve))
      })
      calls2.push(aaveLendingPool!.getEModeCategoryData(1)) // ETH correlated
      users.forEach(u => {
        calls2.push(aaveLendingPool!.getUserEMode(u))
      })
    }

    console.log("calling call2", chain)

    const call2Data = await callWithTimeout(chain, calls2, currentBlockNumber)
    console.log("calling call2: success", chain)
    const calls3: Call[] = []
    const vaultOrLPByBor: { [b: string]: string } = {}
    const stableByBor: { [b: string]: boolean } = {}
    const exchangeRateByCollateral: { [b: string]: bigint } = {}
    const collateralToBorrowables: { [c: string]: string[] } = {}
    const balanceByCollateralByUser: { [c: string]: { [user: string]: bigint } } = {}
    const callsPerCol = 4 + users.length
    const secondBorrowables: string[] = []
    Object.entries(collateralMap).forEach(([col, bors], i) => {
      if (!balanceByCollateralByUser[col])
        balanceByCollateralByUser[col] = {}
      const b0 = call2Data[i * callsPerCol]
      const b1 = call2Data[i * callsPerCol + 1]
      collateralToBorrowables[col] = [b0, b1]
      const underlying = call2Data[i * callsPerCol + 2]
      bors.forEach((b, j) => {
        const secondBor = b === b0 ? b1 : b0
        const borrowable2 = new Contract(secondBor, borrowableAbi)

        secondBorrowables.push(secondBor)

        calls3.push(borrowable2.underlying())
        if ( i === 0 && j === 0) {
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

    const lendingProtocolCalls:Call[] = []

    skipCount = Object.keys(collateralMap).length * callsPerCol
    conf.compoundBorrowings.forEach((address, i) => {
      const { numAssets, baseAsset } = compoundBorrowingInfo[chain][address]
      const asset = conf.assets[baseAsset]
      const div = getDiv(asset)
      compoundBorrowingInfo[chain][address].borrowRate = call2Data[skipCount++]

      let totalDebt = 0n
      users.forEach((u) => {
        const bn = call2Data[skipCount++]
        const debt = toDeposit(bn, div, asset)
        totalDebt += bn
        if (bn > 0) {
          populateSimple(suppliedByUser, [u], -debt.usd)
          console.log('compound debt', -debt.usd)
        }
        populate(compoundDebtByAsset, [asset], bn, div, asset)

        const rewardEarn = compoundBorrowingInfo[chain][address].rewardRate * 24n * 365n * 3600n * ONE * bn / compoundBorrowingInfo[chain][address].totalBorrow / (10n ** 15n)
        const earnings = toDeposit(rewardEarn / 365n, 1e18, ASSETS.COMP)
        populate(compoundBorrowingReward, [], rewardEarn, 1e18, ASSETS.COMP)
        populate(compoundBorrowingRewardByBorrowedAsset, [asset], earnings.bn, 1e18, ASSETS.COMP)


        compoundBorrowingInfo[chain][address].borrowed[u] = { ...debt }
        compoundBorrowingInfo[chain][address].rewards[u] = { ...earnings }
        compoundBorrowingInfo[chain][address].spendings[u] = toDeposit((bn * compoundBorrowingInfo[chain][address].borrowRate * 24n * 3600n) / ONE, div, asset)
      })
      const _bn = (totalDebt * compoundBorrowingInfo[chain][address].borrowRate * 365n * 24n * 3600n) / ONE
      if (_bn > 0) {
        console.log('compound spend', totalDebt, compoundBorrowingInfo[chain][address].borrowRate, _bn)
      }
      populate(compoundSpendingsByAsset, [asset], _bn, div, asset)

      for (let j = 0; j < numAssets; j++) {
        const assetInfo = call2Data[skipCount++]
        const collateral = assetInfo[1]
        const liquidationRatio = assetInfo[5]
        if (conf.assets[collateral]) {
          compoundBorrowingInfo[chain][address].collaterals[collateral] = {}
          compoundBorrowingInfo[chain][address].collateralToAsset[collateral] = conf.assets[collateral]
          compoundBorrowingInfo[chain][address].liquidationRatio[collateral] = liquidationRatio
          users.forEach(u => {
            lendingProtocolCalls.push(compoundBorrowings[i].userCollateral(u, collateral))
          })
        }
      }
    })

    const userEMode: { [user: string]: number } = {}
    const eModeLiqThreshold: { [eMode: number]: number } = {}
    if (conf.aaveLendingPool) {
      assetAddressesOnAAVE.forEach((reserve: string) => {
        // console.log('reserve data', reserve, call2Data[skipCount + i])
        aaveReserveData[chain][reserve] = call2Data[skipCount++]
      })
      const eModeCategoryData = call2Data[skipCount++]
      eModeLiqThreshold[1] = Number(eModeCategoryData[1])
      users.forEach(u => {
        userEMode[u] = Number(call2Data[skipCount++])
      })
    }


    assetAddressesOnAAVE.forEach((reserve: string) => {
      const aToken = new Contract(aaveReserveData[chain][reserve][8], aTokenAbi)
      lendingProtocolCalls.push(aToken.totalSupply())
      const vdToken = new Contract(aaveReserveData[chain][reserve][10], aTokenAbi)
      lendingProtocolCalls.push(vdToken.totalSupply())
      const interestRateModel = new Contract(aaveReserveData[chain][reserve][11], interestRateModelAbi)
      lendingProtocolCalls.push(interestRateModel.getOptimalUsageRatio(reserve))
      users.forEach(u => {
        lendingProtocolCalls.push(aToken.balanceOf(u), vdToken.balanceOf(u))
      })
    })

    console.log("calling call3", chain)
    const call3Data = await tryWithTimeout(chain, calls3, pastBlockNumber, undefined, '0xcA11bde05977b3631167028862bE2a173976CA11')

    console.log("calling call3 success", chain)
    const pastVaultStateByBorrowable: { [b: string]: { timestamp: number, exchangeRate: bigint, totalBalance: bigint } } = {}

    const calls4: Call[] = []

    let cursor = 0
    let sbCursor = 0
    let timestamp: number
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
        // console.log({underlyingAsset})
        calls4.push(new Contract(underlyingAsset, borrowableAbi).symbol())
      })
      vaultByCollateral[col] = vaultOrLPByBor[bors[0]]
      const vault = new Contract(vaultOrLPByBor[bors[0]], vaultAbi)
      console.log({vault: vaultOrLPByBor[bors[0]]})
      calls4.push(vault.reinvest())
      calls4.push(vault.exchangeRate())
      calls4.push(vault.totalBalance())

      const stable = call3Data[cursor++]
      cursor++ // reinvest
      const exchangeRate = call3Data[cursor++] ?? ONE
      const totalBalance = call3Data[cursor++] ?? ONE
      const lp = call3Data[cursor++] ?? vaultByCollateral[col]
      const lpc = new Contract(lp, vaultAbi)
      // console.log({lp})
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

    users.forEach(u => {
      calls4.push(getCurrentEthCallProvider(chain).getEthBalance(u))
    })

    Object.keys(underlyings).forEach(a => {
      users.forEach(u => {
        calls4.push(new Contract(a, borrowableAbi).balanceOf(u))
      })
    })

    console.log("calling call4", chain)
    console.log(calls4)
    const dataFromCall4 = await tryWithTimeout(chain, [...calls4, ...lendingProtocolCalls], currentBlockNumber, undefined, '0xcA11bde05977b3631167028862bE2a173976CA11')

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
        console.log('second borrowable symbol', secondBorrowables[sbCursor - 1],  dataFromCall4[cursor - 1])
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
      if (!reservesByVault[vaultByCollateral[col]])
        reservesByVault[vaultByCollateral[col]] = [reserve0, reserve1]
      if (!lpSupplyByVault[vaultByCollateral[col]])
        lpSupplyByVault[vaultByCollateral[col]] = lpSupply
    })

    console.log("calling call4 success")
    console.log(vaultBalanceAfterReinvestByVault)
    const idleBalances = dataFromCall4.slice(cursor)

    for (let i = 0; i <= Object.keys(underlyings).length; i++) {
      if (i !== 0 && !conf.assets[Object.keys(underlyings)[i - 1]]) {
        throw new Error(`${chain} unknown underlying ${Object.keys(underlyings)[i - 1]}`)
      }
      const asset = i === 0 ? (chain === Chains.FTM ? ASSETS.FTM : (chain === Chains.SONIC ? ASSETS.SONIC : ASSETS.ETH)) : conf.assets[Object.keys(underlyings)[i - 1]]
      const div = getDiv(asset)
      let j = 0
      for (const user of users) {
        const bn = idleBalances[i * users.length + j]
        populate(idleBalancesByAsset, [asset], bn, div, asset)
        populate(idleBalancesByChain, [chain, asset], bn, div, asset)
        if (bn > 0n) {
          populate(idleBalancesByChainByAssetByUser, [chain, asset, user], bn, div, asset)
          const { usd } = toDeposit(bn, div, asset)
          populate(idleBalancesByAssetByUser, [asset, user], bn, div, asset)
          populateSimple(idleBalancesByUser, [user], usd)
          populateSimple(idleBalancesByChainByUser, [chain, user], usd)
        }
        j++
      }
    }

    skipCount = calls4.length

    conf.compoundBorrowings.forEach((address: string) => {
      Object.keys(compoundBorrowingInfo[chain][address].collaterals).forEach((collateral) => {
        const asset = conf.assets[collateral]
        const div = getDiv(asset)
        users.forEach((u) => {
          const bn = dataFromCall4[skipCount++][0]
          // console.log('compound collateral balance', address, u, bn)
          populate(compoundCollateralByAsset, [asset], bn, div, asset)
          compoundBorrowingInfo[chain][address].collaterals[collateral][u] = toDeposit(bn, div, asset)
          if (bn > 0) {
            populateCumulativeByAsset(cumulativeValuesByAsset, asset, Number(bn), Number(bn), 0, 0, 0)
            console.log('compound deposit', compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd)
            populateSimple(suppliedByUser, [u], compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd)
            populate(suppliedByAssetByUser, [asset, u], bn, div, asset)
          }
        })
      })
    })

    Object.keys(compoundBorrowingInfo[chain]).forEach((address) => {
      Object.keys(compoundBorrowingInfo[chain][address].borrowed).forEach((u) => {
        if (compoundBorrowingInfo[chain][address].borrowed[u].bn === 0n) return
        console.log('position', u)
        const borrowedUsd = compoundBorrowingInfo[chain][address].borrowed[u].usd
        let collateralizationUsd = 0
        let collateralTotalUsd = 0
        Object.keys(compoundBorrowingInfo[chain][address].collaterals).forEach((collateral) => {
          if (compoundBorrowingInfo[chain][address].collaterals[collateral][u]) {
            const collateralUsd = compoundBorrowingInfo[chain][address].collaterals[collateral][u].usd
            collateralTotalUsd += collateralUsd
            collateralizationUsd += collateralUsd * Number(compoundBorrowingInfo[chain][address].liquidationRatio[collateral]) / 1e18
          }
        })
        const healthFactor = Number((collateralizationUsd / borrowedUsd).toFixed(2))
        const liquidationPrice = Number((collateralizationUsd / compoundBorrowingInfo[chain][address].borrowed[u].amount).toFixed(2))
        const apr = Number(((compoundBorrowingInfo[chain][address].rewards[u].usd - compoundBorrowingInfo[chain][address].spendings[u].usd) * 365 * 100 / collateralTotalUsd).toFixed(2))
        compoundBorrowingInfo[chain][address].positions[u] = { healthFactor, liquidationPrice, address, collateralTotalUsd: Number(collateralTotalUsd.toFixed(2)), apr }
      })
    })

    assetAddressesOnAAVE.forEach((reserve: string, i: number) => {
      const asset = conf.assets[reserve]
      const div = getDiv(asset)
      const price = getAssetPrice(asset)
      // console.log(call3Data.slice(skipCount))
      const aSupply = dataFromCall4[skipCount + (i * (users.length * 2 + 3))]
      const vdSupply = dataFromCall4[skipCount + (i * (users.length * 2 + 3)) + 1]
      aTokenInfo[chain][reserve] = {
        supply: toDeposit(aSupply, div, asset),
        borrow: toDeposit(vdSupply, div, asset),
        kinkUtilizationRatio: dataFromCall4[skipCount + (i * (users.length * 2 + 3)) + 2],
      }
      users.forEach((u, j) => {
        const aBalance = dataFromCall4[skipCount + (i * (users.length * 2 + 3)) + j * 2 + 3] as bigint
        const vdBalance = dataFromCall4[skipCount + (i * (users.length * 2 + 3)) + j * 2 + 4] as bigint
        // console.log({u, reserve, aBalance, vdBalance})
        const depositUsd = Number((Number(aBalance) / div * price).toFixed(2))
        const borrowedUsd = Number((Number(vdBalance) / div * price).toFixed(2))
        if (aBalance !== vdBalance) {
          console.log('aave deposit', depositUsd - borrowedUsd)
          populateSimple(suppliedByUser, [u], Number((depositUsd - borrowedUsd).toFixed(2)))
        }

        populate(aaveABalancesByAsset, [asset], aBalance, div, asset)

        const earnings = aBalance * aaveReserveData[chain][reserve][2] / 10n ** 27n

        populate(aaveAEarningsByAsset, [asset], earnings, div, asset)

        const earningsUsd = toDeposit(earnings, div, asset).usd

        const spendings = vdBalance * aaveReserveData[chain][reserve][4] / 10n ** 27n
        const spendingsUsd = toDeposit(spendings, div, asset).usd
        populate(aaveVDSpendingsByAsset, [asset], spendings, div, asset)
        populate(aaveABalancesByChainByAssetAddress, [chain, reserve], aBalance, div, asset)
        populate(aaveABalancesByChainByAsset, [chain, asset], aBalance, div, asset)

        if (aBalance > 0) {
          const aToken = aaveReserveData[chain][reserve][8]
          populate(suppliedByChainByBorrowableByUser, [chain, aToken, u], aBalance, div, asset)

          const usd = suppliedByChainByBorrowableByUser[chain][aToken][u].usd
          if (aavePositions[u + chain]) {
            aavePositions[u + chain].collateralTotalUsd = Number((aavePositions[u + chain].collateralTotalUsd + usd).toFixed(2))
            aavePositions[u + chain].collateralizationUsd = Number((aavePositions[u + chain].collateralizationUsd + (usd * (userEMode[u] === 1 ? eModeLiqThreshold[1] : getLiquidationThreshold(aaveReserveData[chain][reserve][0][0])) / 10_000)).toFixed(2))
            if (aavePositions[u + chain].borrowedTotalUsd !== 0) {
              aavePositions[u + chain].healthFactor = Number((aavePositions[u + chain].collateralizationUsd / aavePositions[u + chain].borrowedTotalUsd).toFixed(2))
            }
            populate(aavePositions[u + chain].collaterals, [asset], aBalance, div, asset)
            aavePositions[u + chain].earnings = Number((aavePositions[u + chain].earnings + (earningsUsd / 365)).toFixed(2))
            aavePositions[u + chain].apr = Number((((aavePositions[u + chain].earnings - aavePositions[u + chain].spendings) * 365) * 100 / aavePositions[u + chain].collateralTotalUsd).toFixed(2))
          } else {
            aavePositions[u + chain] = {
              collateralTotalUsd: usd,
              collateralizationUsd: Number((usd * (userEMode[u] === 1 ? eModeLiqThreshold[1] : getLiquidationThreshold(aaveReserveData[chain][reserve][0][0])) / 10_000).toFixed(2)),
              borrowedTotalUsd: 0,
              healthFactor: '∞',
              collaterals: {
                [asset]: toDeposit(aBalance, div, asset)
              },
              borrows: {},
              earnings: Number((earningsUsd / 365).toFixed(2)),
              spendings: 0,
              apr: Number((earningsUsd * 100 / usd).toFixed(2)),
            }
          }

          populate(suppliedByAssetByUser, [asset, u], aBalance, div, asset)

          const earnings = Number((Number(aaveReserveData[chain][reserve][2] * aaveABalancesByChainByAssetAddress[chain][reserve].bn / 365n) / 1e27).toFixed(2))

          populateCumulativeByAsset(cumulativeValuesByAsset, asset, Number(aBalance), Number(aBalance), earnings, earnings, earnings)
          // console.log('aave deposit of', asset, earnings, cumulativeValuesByAsset[asset].newDailyEarnings)
        }

        if (vdBalance > 0) {
          const { usd } = toDeposit(vdBalance, div, asset)
          if (aavePositions[u + chain]) {
            aavePositions[u + chain].borrowedTotalUsd = Number((aavePositions[u + chain].borrowedTotalUsd + usd).toFixed(2))
            aavePositions[u + chain].healthFactor = Number((aavePositions[u + chain].collateralizationUsd / aavePositions[u + chain].borrowedTotalUsd).toFixed(2))
            aavePositions[u + chain].spendings = Number((aavePositions[u + chain].spendings + (spendingsUsd / 365)).toFixed(2))
            aavePositions[u + chain].apr = Number((((aavePositions[u + chain].earnings - aavePositions[u + chain].spendings) * 365) * 100 / aavePositions[u + chain].collateralTotalUsd).toFixed(2))
            populate(aavePositions[u + chain].borrows, [asset], vdBalance, div, asset)
          } else {
            aavePositions[u + chain] = {
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
        populate(aaveVDBalancesByAsset, [asset], vdBalance, div, asset)
        populate(aaveVDBalancesByChainByAsset, [chain, asset], vdBalance, div, asset)
      })
    })

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

      for (let i = 0; i < users.length; i++) {
        const user = users[i]
        let _deposit = deposits[i] as bigint
        if (conf.staking[b]) {
          const stakedBn = call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 3 + i]
          _deposit += stakedBn
          stakedBalance += stakedBn
        }
        if (_deposit > 0n) {
          const bn = (_deposit * newExchangeRate) / ONE
          const {usd} = toDeposit(bn, div, asset)

          populate(suppliedByChainByAssetByUser, [chain, asset, user], bn, div, asset)

          populate(suppliedByAssetByUser, [asset, user], bn, div, asset)
          populate(suppliedByChainByBorrowableByUser, [chain, b, user], bn, div, asset)
          console.log('borrowable deposit', usd)
          populateSimple(suppliedByUser, [user], usd)
          populateSimple(suppliedByChainByUser, [chain, user], usd)
        }
        balance += _deposit
      }

      const oldUserSupplied = Math.floor(Number((balance * oldExchangeRate) / ONE))
      const suppliedBN = (balance * newExchangeRate) / ONE
      const newUserSupplied = Number(suppliedBN)

      const platform = name.substring(0, name.indexOf(' '))
      const newSupply = newTotalBorrows + newTotalBalance

      const oldDailyYield = oldBorrowRate * 24n * 3600n * oldTotalBorrows * (ONE - reserveFactor) / ONE

      const oldSupply = oldTotalBorrows + oldTotalBalance

      const oldDailyApr = Number(oldDailyYield / oldSupply) / 1e18

      const oldDailyEarnings = Math.floor(oldUserSupplied * oldDailyApr)

      const newDailyYield = newBorrowRate * 3600n * 24n * newTotalBorrows * (ONE - reserveFactor) / ONE

      let stakingDailyYield = 0n
      let stakingDailyEarningsUsd = 0
      let stakingAPR = 0
      let stakingDailyEarnings = 0
      let totalStakedUsd = 0
      let stakingRewardAsset: string = ''


      const suppliedUsd = Number(((newUserSupplied * (getAssetPrice(asset))) / div).toFixed(2))
      if (conf.staking[b]) {
        const periodFinish = call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool]
        if (periodFinish > blockTimestamp) {
          stakingRewardAsset = conf.assets[conf.staking[b].rewardToken]
          const _div = getDiv(stakingRewardAsset as ASSETS)
          const rewardRate = call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 1]
          const totalSupply: bigint = call1Data[callsPerBor * conf.borrowables.length + stakingPoolCursor * callsPerStakingPool + 2]
          const yearlyRewardUsd = Number(rewardRate * 24n * 3600n * 365n) / _div * getAssetPrice(stakingRewardAsset as ASSETS)
          stakingDailyYield = rewardRate * 24n * 3600n * stakedBalance / totalSupply
          totalStakedUsd = Number(totalSupply * newExchangeRate / ONE) / div * getAssetPrice(asset)
          stakingAPR = Number((yearlyRewardUsd * 100 / totalStakedUsd).toFixed(2))
        }
        stakingPoolCursor++
      }

      const newDailyApr = Number(newDailyYield / newSupply) / 1e18
      const newDailyEarnings = Math.floor(newUserSupplied * newDailyApr)
      if (stakingAPR > 0) {
        const _div = getDiv(stakingRewardAsset as ASSETS)
        stakingDailyEarningsUsd = stakingDailyYield === 0n ? 0 : Number(((Number(stakingDailyYield) *
            (getAssetPrice(stakingRewardAsset as ASSETS)) / _div)).toFixed(2))
        stakingDailyEarnings = Number((Number(stakingDailyYield) / _div).toFixed(4))
      }

      const utilization = (newTotalBorrows * ONE) / newSupply
      const availableToDeposit =
          kinkUtilizationRate >= utilization ? 0n : (newTotalBorrows * ONE) / kinkUtilizationRate - newSupply

      const reinvestPeriod = blockTimestamp - pastVaultStateByBorrowable[b].timestamp

      const v = vaultOrLPByBor[b]

      const bigBalanceChange = vaultBalanceAfterReinvestByVault[v] === pastVaultStateByBorrowable[b].totalBalance ? false : vaultBalanceAfterReinvestByVault[v] > pastVaultStateByBorrowable[b].totalBalance
          ? (vaultBalanceAfterReinvestByVault[v] - pastVaultStateByBorrowable[b].totalBalance) * 100n / pastVaultStateByBorrowable[b].totalBalance > 8n
          : (pastVaultStateByBorrowable[b].totalBalance - vaultBalanceAfterReinvestByVault[v]) * 100n / vaultBalanceAfterReinvestByVault[v] > 8n
      const vaultAPR = bigBalanceChange ? 'unknown' : Number((Number(vaultExchangeRateAfterReinvestByVault[v] - pastVaultStateByBorrowable[b].exchangeRate) * 360000 * 24 * 365 / reinvestPeriod / Number(pastVaultStateByBorrowable[b].exchangeRate)).toFixed(2))

      aprByVault[v] = vaultAPR

      const c = collateralByBorrowable[b]
      const oppositeSymbol = collateralToBorrowables[c][0] === b ? symbolByBorrowable[collateralToBorrowables[c][1]] : symbolByBorrowable[collateralToBorrowables[c][0]]

      pools.push({
        platform,
        borrowable: b,
        asset,
        suppliedBN,
        tvl: Number((Number(newSupply) / div).toFixed(4)),
        tvlUsd: Number((Number(newSupply) / div * getAssetPrice(asset)).toFixed(2)),
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
        earningsOldUsd: Number(((oldDailyEarnings * (getAssetPrice(asset))) / div).toFixed(2)),
        earningsNewUsd: Number(((newDailyEarnings * (getAssetPrice(asset))) / div).toFixed(2)),
        availableToDeposit: Number((Number(availableToDeposit) / div).toFixed(4)),
        availableToDepositUsd: Number(((Number(availableToDeposit) * (getAssetPrice(asset))) / div).toFixed(2)),
        oppositeSymbol,
        vaultAPR,
        vault: vaultOrLPByBor[b],
        stable: stableByBor[b],
        chain,
      })

      if (cumulativeValuesByChains[chain][asset]) {
        cumulativeValuesByChains[chain][asset].oldUserSupplied += oldUserSupplied
        cumulativeValuesByChains[chain][asset].newUserSupplied += newUserSupplied
        cumulativeValuesByChains[chain][asset].oldDailyEarnings += oldDailyEarnings
        cumulativeValuesByChains[chain][asset].newDailyEarnings += newDailyEarnings
        cumulativeValuesByChains[chain][asset].maxDailyEarnings +=
            newDailyEarnings > oldDailyEarnings ? newDailyEarnings : oldDailyEarnings
      } else {
        cumulativeValuesByChains[chain][asset] = {
          oldUserSupplied,
          newUserSupplied,
          oldDailyEarnings,
          oldDailyEarningsUsd: 0,
          newDailyEarnings,
          maxDailyEarnings: newDailyEarnings > oldDailyEarnings ? newDailyEarnings : oldDailyEarnings,
          maxDailyEarningsUsd: 0,
          currentAPR: 0,
          newUserSuppliedUsd: 0,
          maxAPR: 0,
        }
      }

      populateCumulativeByAsset(cumulativeValuesByAsset, asset, oldUserSupplied, newUserSupplied, oldDailyEarnings, newDailyEarnings, newDailyEarnings > oldDailyEarnings ? newDailyEarnings : oldDailyEarnings)
      // console.log('final aave deposit of', asset, newDailyEarnings, cumulativeValuesByAsset[asset].newDailyEarnings)
    })

    Object.keys(collateralMap).forEach((col) => {
      const v = vaultByCollateral[col]
      users.forEach(u => {
        const colBal = balanceByCollateralByUser[col][u]
        if (colBal === 0n) return
        const vaultAmount = colBal * exchangeRateByCollateral[col] / ONE
        const lpAmount = vaultAmount * vaultExchangeRateAfterReinvestByVault[v] / ONE
        let positionPrice
        if (conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]) {
          const asset = conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]
          const assetAmount = lpAmount * reservesByVault[v][0] * 2n / lpSupplyByVault[v]
          const div = getDiv(asset)
          positionPrice = Number(assetAmount) / div * getAssetPrice(asset)
        } else  {
          const asset = conf.assets[borrowableToUnderlying[collateralToBorrowables[col][1]]]
          const assetAmount = lpAmount * reservesByVault[v][1] * 2n / lpSupplyByVault[v]
          const div = getDiv(asset)
          positionPrice = Number(assetAmount) / div * getAssetPrice(asset)
        }
        const earnings = typeof aprByVault[v] === "number" ? Number((positionPrice * aprByVault[v] / 365 / 100).toFixed(2)) : 0

        let symbol = (symbolByBorrowable[collateralToBorrowables[col][0]] ?? conf.assets[borrowableToUnderlying[collateralToBorrowables[col][0]]]) +
            '/' + (symbolByBorrowable[collateralToBorrowables[col][1]] ?? conf.assets[borrowableToUnderlying[collateralToBorrowables[col][1]]])
        console.log('collateral earn', u, symbol, positionPrice, earnings)
        suppliedAsCollateral += positionPrice
        earningsAsCollateral += earnings
      })
    })

    assetAddressesOnAAVE.forEach((aaveAsset: string) => {
      const asset = conf.assets[aaveAsset]
      const div = getDiv(asset)
      // console.log(aaveAsset, aTokenInfo)
      const utilization = aTokenInfo[chain][aaveAsset].borrow.bn * ONE / aTokenInfo[chain][aaveAsset].supply.bn
      const availableToDeposit = aTokenInfo[chain][aaveAsset].borrow.bn - (aTokenInfo[chain][aaveAsset].supply.bn * aTokenInfo[chain][aaveAsset].kinkUtilizationRatio / 10n ** 27n)
      const apr = Number((Number(aaveReserveData[chain][aaveAsset][2]) / 1e25).toFixed(2))
      const earnings = Number((Number(aaveReserveData[chain][aaveAsset][2] * aaveABalancesByChainByAssetAddress[chain][aaveAsset].bn / 365n) / 1e27).toFixed(2))
      pools.push({
        platform: 'AAVE',
        borrowable: aaveReserveData[chain][aaveAsset][8],
        asset,
        suppliedBN: aaveABalancesByChainByAssetAddress[chain][aaveAsset].bn,
        supplied: aaveABalancesByChainByAssetAddress[chain][aaveAsset].amount,
        suppliedUsd: aaveABalancesByChainByAssetAddress[chain][aaveAsset].usd,
        tvl: aTokenInfo[chain][aaveAsset].supply.amount,
        tvlUsd: aTokenInfo[chain][aaveAsset].supply.usd,
        stakingDailyEarningsUsd: 0,
        stakingAPR: 0,
        stakingDailyEarnings: 0,
        stakingRewardAsset: '',
        kink: Number((Number(aTokenInfo[chain][aaveAsset].kinkUtilizationRatio) / 1e25).toFixed(2)),
        utilization: Number((Number(utilization) / 1e16).toFixed(2)),
        aprOld: apr,
        aprNew: apr,
        earningsOld: Number((earnings / div).toFixed(4)),
        earningsNew: Number((earnings / div).toFixed(4)),
        earningsOldUsd: Number(((earnings * (getAssetPrice(asset))) / div).toFixed(2)),
        earningsNewUsd: Number(((earnings * (getAssetPrice(asset))) / div).toFixed(2)),
        availableToDeposit: Number((Number(availableToDeposit < 0 ? 0n : availableToDeposit) / div).toFixed(4)),
        availableToDepositUsd: Number(((Number(availableToDeposit < 0 ? 0n : availableToDeposit) * (getAssetPrice(asset))) / div).toFixed(2)),
        oppositeSymbol: '',
        vaultAPR: '',
        vault: '',
        stable: false,
        chain,
      })
    })
  }

  await Promise.all(chains.map(callChain))

  for (const c in Chains) {
    for (const a in ASSETS) {
      const div = getDiv(a as ASSETS)
      const aca = cumulativeValuesByChains[c][a]
      if (aca) {
        aca.currentAPR = aca.newUserSupplied === 0 ? 0 : Number((aca.oldDailyEarnings * 36500 / aca.newUserSupplied).toFixed(2))
        aca.maxAPR = aca.newUserSupplied === 0 ? 0 : Number((aca.maxDailyEarnings * 36500 / aca.newUserSupplied).toFixed(2))
        aca.oldDailyEarningsUsd = Number((aca.oldDailyEarnings * getAssetPrice(a as ASSETS) / div).toFixed(2))
        aca.maxDailyEarningsUsd = Number((aca.maxDailyEarnings * getAssetPrice(a as ASSETS) / div).toFixed(2))
        aca.newUserSuppliedUsd = Number((aca.newUserSupplied * getAssetPrice(a as ASSETS) / div).toFixed(2))
        aca.oldDailyEarnings = Number((aca.oldDailyEarnings / div).toFixed(4))
        aca.newUserSupplied = Number((aca.newUserSupplied / div).toFixed(4))
        aca.maxDailyEarnings = Number((aca.maxDailyEarnings / div).toFixed(4))
        chainAggregatedStats[c].newUserSuppliedUsd = Number((chainAggregatedStats[c].newUserSuppliedUsd + aca.newUserSuppliedUsd).toFixed(2))
        chainAggregatedStats[c].oldDailyEarningsUsd = Number((chainAggregatedStats[c].oldDailyEarningsUsd + aca.oldDailyEarningsUsd).toFixed(2))
        chainAggregatedStats[c].maxDailyEarningsUsd = Number((chainAggregatedStats[c].maxDailyEarningsUsd + aca.maxDailyEarningsUsd).toFixed(2))
        chainAggregatedStats[c].maxAPR = chainAggregatedStats[c].newUserSuppliedUsd === 0 ? 0 : Number((chainAggregatedStats[c].maxDailyEarningsUsd * 36500 / chainAggregatedStats[c].newUserSuppliedUsd).toFixed(2))
        chainAggregatedStats[c].currentAPR = chainAggregatedStats[c].newUserSuppliedUsd === 0 ? 0 : Number((chainAggregatedStats[c].oldDailyEarningsUsd * 36500 / chainAggregatedStats[c].newUserSuppliedUsd).toFixed(2))
        if (aca.newUserSuppliedUsd + idleBalancesByChain[c][a].usd === 0) {
          delete cumulativeValuesByChains[c][a]
        }
      }
    }
  }

  Object.entries(idleBalancesByChain).forEach(([chain, props]) => {
    chainAggregatedStats[chain].usd = Number(Object.values(props).reduce((acc, { usd }) => acc + usd, 0).toFixed(2))
  })

  const sortedChains = Object.keys(cumulativeValuesByChains).sort((a, b) => {
    return chainAggregatedStats[b].newUserSuppliedUsd - chainAggregatedStats[a].newUserSuppliedUsd
  })

  sortedChains.forEach((chain, i) => {
    const val = cumulativeValuesByChains[chain]
    const sortedAssets = Object.keys(val).sort((assetA, assetB) => {
      return (val[assetB].newUserSuppliedUsd + (idleBalancesByChain[chain][assetB] ? idleBalancesByChain[chain][assetB].usd : 0))
          - (val[assetA].newUserSuppliedUsd + (idleBalancesByChain[chain][assetA] ? idleBalancesByChain[chain][assetA].usd : 0))
    })
    sortedAssets.forEach((x, j) => {
      if (j === 0) return
      const val2 = val[x]
      delete val[x]
      val[x] = val2
    })
    if (i === 0) return
    delete cumulativeValuesByChains[chain]
    cumulativeValuesByChains[chain] = val
  })

  console.log('compoundBorrowingReward.usd', compoundBorrowingReward.usd)

  console.log('supplied as collateral', suppliedAsCollateral)
  console.log('earnings as collateral', earningsAsCollateral)

  let totalDeposited = 0
  let oldTotalEarnings = compoundBorrowingReward.usd / 365
  let newTotalEarnings = compoundBorrowingReward.usd / 365
  let maxTotalEarnings = compoundBorrowingReward.usd / 365
  for (const a in ASSETS) {
    const price = getAssetPrice(a as ASSETS)
    const div = getDiv(a as ASSETS)
    const ca = cumulativeValuesByAsset[a]
    if (ca) {
      // if (aaveABalancesByAsset[a]) {
      //   totalDeposited += Number(aaveABalancesByAsset[a].usd)
      //   if (aaveABalancesByAsset[a].usd > 0) {
      //     console.log('aave deposit', a, aaveABalancesByAsset[a])
      //   }
      // }
      // if (compoundCollateralByAsset[a]) {
      //   totalDeposited += Number(compoundCollateralByAsset[a].usd)
      //   if (compoundCollateralByAsset[a].usd > 0) {
      //     console.log('compound deposit', a, compoundCollateralByAsset[a])
      //   }
      // }
      if (aaveVDBalancesByAsset[a]) {
        totalDeposited -= Number(aaveVDBalancesByAsset[a].usd)
        if (aaveVDBalancesByAsset[a].usd > 0) {
          console.log('aave debt', a, aaveVDBalancesByAsset[a])
        }
      }
      if (compoundDebtByAsset[a]) {
        totalDeposited -= Number(compoundDebtByAsset[a].usd)
        if (compoundDebtByAsset[a].usd > 0) {
          console.log('compound debt', a, compoundDebtByAsset[a])
        }
      }
      // if (aaveAEarningsByAsset[a]) {
      //   oldTotalEarnings += Number(aaveAEarningsByAsset[a].usd) / 365
      //   newTotalEarnings += Number(aaveAEarningsByAsset[a].usd) / 365
      //   maxTotalEarnings += Number(aaveAEarningsByAsset[a].usd) / 365
      // }
      if (aaveVDSpendingsByAsset[a]) {
        oldTotalEarnings -= Number(aaveVDSpendingsByAsset[a].usd) / 365
        newTotalEarnings -= Number(aaveVDSpendingsByAsset[a].usd) / 365
        maxTotalEarnings -= Number(aaveVDSpendingsByAsset[a].usd) / 365
      }
      if (compoundSpendingsByAsset[a]) {
        if (compoundSpendingsByAsset[a].usd > 0) {
          console.log('compound spendings', a, Number(compoundSpendingsByAsset[a].usd) / 365)
        }
        oldTotalEarnings -= Number(compoundSpendingsByAsset[a].usd) / 365
        newTotalEarnings -= Number(compoundSpendingsByAsset[a].usd) / 365
        maxTotalEarnings -= Number(compoundSpendingsByAsset[a].usd) / 365
      }
      const [depUsd, oldEarnings, newEarinings, maxEarnings] = formatStats(ca, price, div)
      totalDeposited += Number(depUsd)
      oldTotalEarnings += Number(oldEarnings)
      newTotalEarnings += Number(newEarinings)
      maxTotalEarnings += Number(maxEarnings)
      ca.currentAPR = ca.newUserSupplied === 0 ? 0 : Number((ca.oldDailyEarnings * 36500 / ca.newUserSupplied).toFixed(2))
      ca.maxAPR = ca.newUserSupplied === 0 ? 0 : Number((ca.maxDailyEarnings * 36500 / ca.newUserSupplied).toFixed(2))
      ca.oldDailyEarningsUsd = Number((ca.oldDailyEarnings * getAssetPrice(a as ASSETS) / div).toFixed(2))
      ca.maxDailyEarningsUsd = Number((ca.maxDailyEarnings * getAssetPrice(a as ASSETS) / div).toFixed(2))
      ca.newUserSuppliedUsd = Number((ca.newUserSupplied * getAssetPrice(a as ASSETS) / div).toFixed(2))
      ca.oldDailyEarnings = Number((ca.oldDailyEarnings / div).toFixed(4))
      ca.newUserSupplied = Number((ca.newUserSupplied / div).toFixed(4))
      ca.maxDailyEarnings = Number((ca.maxDailyEarnings / div).toFixed(4))
      if (cumulativeValuesByAsset[a].newUserSuppliedUsd + idleBalancesByAsset[a].usd < 1) {
        delete cumulativeValuesByAsset[a]
      }
    }
  }

  const sortedAssets = Object.keys(cumulativeValuesByAsset).sort((a, b) => {
    return cumulativeValuesByAsset[b].newUserSuppliedUsd - cumulativeValuesByAsset[a].newUserSuppliedUsd
  })

  sortedAssets.forEach((x, i) => {
    if (i === 0) return
    const val = cumulativeValuesByAsset[x]
    delete cumulativeValuesByAsset[x]
    cumulativeValuesByAsset[x] = val
  })

  sortByUserSimple(idleBalancesByUser)
  sortByUserSimple(suppliedByUser)

  const sortedIds = Object.keys(aavePositions).sort((a, b) => {
    return aavePositions[b].collateralTotalUsd - aavePositions[a].collateralTotalUsd
  })
  sortedIds.forEach((x, i) => {
    if (i === 0) return
    const val = aavePositions[x]
    delete aavePositions[x]
    aavePositions[x] = val
  })

  function sortByUserDeposit(byUser: { [user: string]: Deposit }) {
    const sortedUsers = Object.keys(byUser).sort((a, b) => {
      return byUser[b].usd === byUser[a].usd ? byUser[b].amount - byUser[a].amount : byUser[b].usd - byUser[a].usd
    })
    sortedUsers.forEach((x, i) => {
      if (i === 0) return
      const val = byUser[x]
      delete byUser[x]
      byUser[x] = val
    })
  }

  function sortByUserSimple(byUser: { [user: string]: number }) {
    const sortedUsers = Object.keys(byUser).sort((a, b) => {
      return byUser[b] - byUser[a]
    })
    sortedUsers.forEach((x, i) => {
      if (i === 0) return
      const val = byUser[x]
      delete byUser[x]
      byUser[x] = val
    })
  }

  ;[idleBalancesByAssetByUser, suppliedByAssetByUser].forEach((userMap) => {
    Object.entries(userMap).forEach(([_, byUser]) => {
      sortByUserDeposit(byUser)
    })
  })

  ;[idleBalancesByChainByAssetByUser, suppliedByChainByAssetByUser].forEach((userMap) => {
    Object.values(userMap).forEach((idleByAssetByUser) => {
      Object.values(idleByAssetByUser).forEach(sortByUserDeposit)
    })
  })

  ;[idleBalancesByChainByUser, suppliedByChainByUser].forEach((userMap) => {
    Object.values(userMap).forEach(sortByUserSimple)
  })

  Object.values(suppliedByChainByBorrowableByUser).forEach((chau) => {
    Object.values(chau).forEach(sortByUserDeposit)
  })

  const maxAPR = ((maxTotalEarnings * 36500) / totalDeposited).toFixed(2)

  const poolChains: { [chain: string]: true } = {}
  const poolAssets: { [chain: string]: true } = {}

  const goodPools = pools.filter(
      (x) => {
        const good = x.suppliedUsd > 1 ||
        (
            ((x.stakingAPR + x.aprNew) > aprThreshold && x.availableToDepositUsd > capacityThreshold && x.tvlUsd > minTVL)
        )
        if (good) {
          poolChains[x.chain] = true
          poolAssets[x.asset] = true
        }
        return good
      }
  ).sort((a, b) => {
    // const aTVL = a.tvlUsd < 1_000 ? 1 : a.tvlUsd
    // const bTVL = b.tvlUsd < 1_000 ? 1 : b.tvlUsd
    return (b.aprNew + b.stakingAPR) - (a.aprNew + a.stakingAPR)
  })

  const currentAPR = ((oldTotalEarnings * 36500) / totalDeposited).toFixed(2)

  const usd = Object.values(idleBalancesByAsset).reduce((acc, curr) => {
    return acc + curr.usd
  }, 0)

  const res = {
    goodPools,
    idleBalancesByAsset,
    idleBalancesByChain,
    idleBalancesByChainByUser,
    idleBalancesByChainByAssetByUser,
    idleBalancesByAssetByUser,
    idleBalancesByUser,
    cumulativeValuesByChains,
    cumulativeValuesByAsset,
    suppliedByUser,
    suppliedByAssetByUser,
    suppliedByChainByUser,
    suppliedByChainByAssetByUser,
    suppliedByChainByBorrowableByUser,
    compoundBorrowingRewardByBorrowedAsset,
    totalDeposited: totalDeposited.toFixed(2),
    oldTotalEarnings: oldTotalEarnings.toFixed(2),
    newTotalEarnings: newTotalEarnings.toFixed(2),
    maxTotalEarnings: maxTotalEarnings.toFixed(2),
    maxAPR,
    currentAPR,
    aavePositions,
    chainAggregatedStats,
    poolAssets: Object.keys(poolAssets),
    poolChains: Object.keys(poolChains),
    usd: usd.toFixed(2),
    users,
    compoundBorrowingInfo,
  }

  ;(BigInt.prototype as any).toJSON = function () {
    return this.toString();
  }

  // console.log(JSON.stringify(res).toString())

  return res
}

function populateCumulativeByAsset(
  cumulativeValuesByAsset: any,
  asset: string,
  oldUserSupplied: number,
  newUserSupplied: number,
  oldDailyEarnings: number,
  newDailyEarnings: number,
  maxDailyEarnings: number
) {
  if (cumulativeValuesByAsset[asset]) {
    cumulativeValuesByAsset[asset].oldUserSupplied += oldUserSupplied
    cumulativeValuesByAsset[asset].newUserSupplied += newUserSupplied
    cumulativeValuesByAsset[asset].oldDailyEarnings += oldDailyEarnings
    cumulativeValuesByAsset[asset].newDailyEarnings += newDailyEarnings
    cumulativeValuesByAsset[asset].maxDailyEarnings += maxDailyEarnings
  } else {
    cumulativeValuesByAsset[asset] = {
      oldUserSupplied: oldUserSupplied,
      newUserSupplied: newUserSupplied,
      oldDailyEarnings: oldDailyEarnings,
      newDailyEarnings: newDailyEarnings,
      newUserSuppliedUsd: 0,
      oldDailyEarningsUsd: 0,
      maxDailyEarningsUsd: 0,
      currentAPR: 0,
      maxAPR: 0,
      maxDailyEarnings: maxDailyEarnings,
    }
  }
}

function formatStats(stats: AssetStats, price: number, div: number) {
  return [
    ((stats.newUserSupplied / div) * price).toFixed(2),
    ((stats.oldDailyEarnings / div) * price).toFixed(2),
    ((stats.newDailyEarnings / div) * price).toFixed(2),
    ((stats.maxDailyEarnings / div) * price).toFixed(2),
  ]
}

const LIQUIDATION_THRESHOLD_MASK = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFF')
const LIQUIDATION_THRESHOLD_START_BIT_POSITION = 16n

function getLiquidationThreshold(configuration: bigint): number {
  console.log('configuration', configuration)
  return Number((configuration & ~LIQUIDATION_THRESHOLD_MASK) >> LIQUIDATION_THRESHOLD_START_BIT_POSITION)
}
