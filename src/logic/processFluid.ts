import { getAddress } from 'ethers'
import { ASSETS, CHAIN_CONF, Chains, getDiv } from '../constants/constants'
import type { AssetStats, Deposit } from '../types'
import { getAssetPrice } from './assetPrices'
import type { LoadContext } from './loadContext'

interface UserPosition {
  nftId: bigint
  owner: string
  supply: bigint
  borrow: bigint
}
interface VaultData {
  isSmartCol: boolean
  isSmartDebt: boolean
  constantVariables: {
    vaultId: bigint
    vaultType: bigint
    supply: string
    borrow: string
    supplyToken: { token0: string; token1: string }
    borrowToken: { token0: string; token1: string }
  }
  exchangePricesAndRates: { supplyRateVault: bigint; borrowRateVault: bigint }
  configs: { liquidationThreshold: bigint; oraclePriceLiquidate: bigint }
}
export type FluidPositionData = [UserPosition, VaultData]
export interface FluidDexData {
  dexState: {
    token0PerSupplyShare: bigint
    token1PerSupplyShare: bigint
    token0PerBorrowShare: bigint
    token1PerBorrowShare: bigint
  }
  limitsAndAvailability: {
    liquidityTokenData0: { supplyRate: bigint; borrowRate: bigint }
    liquidityTokenData1: { supplyRate: bigint; borrowRate: bigint }
  }
}

export function fluidDexAddresses(positions: FluidPositionData[]) {
  const addresses = new Set<string>()
  for (const [position, vault] of positions) {
    if (position.supply > 0n && vault.isSmartCol) addresses.add(vault.constantVariables.supply)
    if (position.borrow > 0n && vault.isSmartDebt) addresses.add(vault.constantVariables.borrow)
  }
  return [...addresses]
}

function positionSide(
  position: UserPosition,
  vault: VaultData,
  dexes: Record<string, FluidDexData>,
  side: 'supply' | 'borrow',
) {
  const balance = position[side]
  if (balance < 0n) throw new Error('Negative Fluid balance')
  if (balance === 0n) return []
  const supply = side === 'supply'
  const smart = supply ? vault.isSmartCol : vault.isSmartDebt
  const constants = vault.constantVariables
  const dex = dexes[constants[side]]
  if (smart && !dex) throw new Error(`Missing Fluid DEX data for vault ${constants.vaultId}`)
  const keys = smart ? (['token0', 'token1'] as const) : (['token0'] as const)
  return keys.map((key) => {
    const address = constants[`${side}Token`][key]
    const asset =
      address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        ? ASSETS.ETH
        : CHAIN_CONF[Chains.MAINNET].assets[getAddress(address)]
    if (!asset) throw new Error(`Unknown Fluid asset ${address} in vault ${constants.vaultId}`)
    const bn = smart ? (balance * dex.dexState[`${key}Per${supply ? 'Supply' : 'Borrow'}Share`]) / 10n ** 18n : balance
    const amount = Number(bn) / getDiv(asset)
    const usd = amount * getAssetPrice(asset)
    // shortcut: on-chain APR excludes DEX trading fees and external rewards; add historical fee accounting for total yield.
    const bps =
      Number(vault.exchangePricesAndRates[`${side}RateVault`]) +
      (smart
        ? Number(
            dex.limitsAndAvailability[key === 'token0' ? 'liquidityTokenData0' : 'liquidityTokenData1'][`${side}Rate`],
          )
        : 0)
    if (bn < 0n || !Number.isFinite(usd) || (bn > 0n && usd <= 0) || !Number.isFinite(bps))
      throw new Error(`Invalid valuation in Fluid vault ${constants.vaultId}`)
    return { asset, amount, bn, usd, apr: bps / 100 }
  })
}

export function parseFluidPositions(positions: FluidPositionData[], dexes: Record<string, FluidDexData>) {
  return positions
    .filter(([position]) => position.supply !== 0n || position.borrow !== 0n)
    .map(([position, vault]) => {
      if (![10000n, 20000n, 30000n, 40000n].includes(vault.constantVariables.vaultType))
        throw new Error('Unknown Fluid vault type')
      const supply = positionSide(position, vault, dexes, 'supply')
      const borrow = positionSide(position, vault, dexes, 'borrow')
      const { liquidationThreshold, oraclePriceLiquidate } = vault.configs
      // Oracle converts collateral units (or shares) to debt units at 1e27; threshold is in basis points.
      const healthFactor =
        position.borrow === 0n
          ? '∞'
          : oraclePriceLiquidate <= 0n || liquidationThreshold <= 0n || liquidationThreshold > 10000n
            ? '—'
            : (
                Number(position.supply * oraclePriceLiquidate * liquidationThreshold) /
                Number(position.borrow * 10n ** 31n)
              ).toFixed(3)
      const value = (legs: typeof supply) => legs.reduce((sum, leg) => sum + leg.usd, 0)
      const income = (legs: typeof supply) => legs.reduce((sum, leg) => sum + (leg.usd * leg.apr) / 36500, 0)
      return {
        id: position.nftId.toString(),
        vault: vault.constantVariables.vaultId.toString(),
        user: position.owner,
        smart: vault.isSmartCol || vault.isSmartDebt,
        healthFactor,
        supply,
        borrow,
        equity: value(supply) - value(borrow),
        daily: income(supply) - income(borrow),
      }
    })
}

export type FluidPosition = ReturnType<typeof parseFluidPositions>[number]

function mergeDeposit(map: Record<string, Deposit>, key: string, leg: Deposit) {
  const entry = (map[key] ??= { bn: 0n, amount: 0, usd: 0 })
  entry.bn += leg.bn
  entry.amount += leg.amount
  entry.usd += leg.usd
}

function addSupply(map: Record<string, AssetStats>, leg: FluidPosition['supply'][number]) {
  const stats = (map[leg.asset] ??= {
    oldUserSupplied: 0,
    newUserSupplied: 0,
    newUserSuppliedUsd: 0,
    oldDailyEarnings: 0,
    oldDailyEarningsUsd: 0,
    newDailyEarnings: 0,
    maxDailyEarnings: 0,
    maxDailyEarningsUsd: 0,
    currentAPR: 0,
    maxAPR: 0,
  })
  stats.newUserSupplied += leg.amount
  stats.newUserSuppliedUsd += leg.usd
  stats.oldDailyEarnings += (leg.amount * leg.apr) / 36500
  stats.maxDailyEarnings += (leg.amount * leg.apr) / 36500
  stats.oldDailyEarningsUsd += (leg.usd * leg.apr) / 36500
  stats.maxDailyEarningsUsd += (leg.usd * leg.apr) / 36500
  stats.currentAPR = Number(((stats.oldDailyEarningsUsd * 36500) / stats.newUserSuppliedUsd).toFixed(2))
  stats.maxAPR = Number(((stats.maxDailyEarningsUsd * 36500) / stats.newUserSuppliedUsd).toFixed(2))
}

// Existing Assets and Networks views report gross supplied capital and supply income.
export function applyFluidPositions(ctx: LoadContext, positions: FluidPosition[]) {
  const chain = Chains.MAINNET
  const stats = ctx.chainAggregatedStats[chain]
  const debts: Record<string, Deposit> = {}
  for (const { supply, borrow, user } of positions) {
    for (const leg of borrow) mergeDeposit(debts, leg.asset, leg)
    for (const leg of supply) {
      if (!leg.bn) continue
      addSupply(ctx.cumulativeValuesByAsset, leg)
      addSupply(ctx.cumulativeValuesByChains[chain], leg)
      const chainAssets = (ctx.suppliedByChainByAssetByUser[chain] ??= {})
      mergeDeposit((ctx.suppliedByAssetByUser[leg.asset] ??= {}), user, leg)
      mergeDeposit((chainAssets[leg.asset] ??= {}), user, leg)
      const chainUsers = (ctx.suppliedByChainByUser[chain] ??= {})
      chainUsers[user] = (chainUsers[user] ?? 0) + leg.usd
      ctx.suppliedByUser[user] = (ctx.suppliedByUser[user] ?? 0) + leg.usd
      stats.newUserSuppliedUsd += leg.usd
      stats.oldDailyEarningsUsd += (leg.usd * leg.apr) / 36500
      stats.maxDailyEarningsUsd += (leg.usd * leg.apr) / 36500
      stats.currentAPR = Number(((stats.oldDailyEarningsUsd * 36500) / stats.newUserSuppliedUsd).toFixed(2))
      stats.maxAPR = Number(((stats.maxDailyEarningsUsd * 36500) / stats.newUserSuppliedUsd).toFixed(2))
    }
  }
  return debts
}
