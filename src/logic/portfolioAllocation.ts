import type { LoadContext } from './loadContext'

const stableAssets = new Set([
  'USDC',
  'USDT',
  'DAI',
  'XDAI',
  'LUSD',
  'FRAX',
  'GHO',
  'sDAI',
  'crvUSD',
  'PYUSD',
  'USDe',
  'sUSDe',
  'USDS',
  'RLUSD',
  'USDtb',
  'eUSDe',
  'EURC',
  'mUSD',
  'syrupUSDT',
  'USDG',
  'syrupUSDC',
  'sUSD',
  'MAI',
])

export function portfolioAllocation(
  supplied: LoadContext['suppliedByAssetByUser'],
  idle: LoadContext['idleBalancesByAssetByUser'],
  debts: LoadContext['aaveVDBalancesByAsset'][] = [],
) {
  const groups = [
    { label: 'Stables', color: '#73dfa5', usd: 0, idleUsd: 0, debtUsd: 0 },
    { label: 'ETH', color: '#91a7ff', usd: 0, idleUsd: 0, debtUsd: 0 },
    { label: 'BTC', color: '#f6b85c', usd: 0, idleUsd: 0, debtUsd: 0 },
    { label: 'Other', color: '#c49aeb', usd: 0, idleUsd: 0, debtUsd: 0 },
  ]
  function add(asset: string, usd: number, side: 'usd' | 'idleUsd' | 'debtUsd') {
    if (!Number.isFinite(usd) || usd <= 0) return
    const stable = stableAssets.has(asset) || /^PT-(?:eUSDE|sUSDE|USDe|sUSDe|srUSDe|USDG)-/.test(asset)
    const index = stable ? 0 : ['ETH', 'WETH'].includes(asset) ? 1 : ['BTC', 'WBTC', 'cbBTC'].includes(asset) ? 2 : 3
    groups[index][side] += usd
  }
  for (const [asset, users] of [...Object.entries(supplied), ...Object.entries(idle)]) {
    for (const deposit of Object.values(users)) add(asset, deposit.usd, 'usd')
  }
  for (const [asset, users] of Object.entries(idle)) {
    for (const deposit of Object.values(users)) add(asset, deposit.usd, 'idleUsd')
  }
  for (const debtMap of debts) {
    for (const [asset, debt] of Object.entries(debtMap)) add(asset, debt.usd, 'debtUsd')
  }
  const total = groups.reduce((sum, group) => sum + group.usd, 0)
  const totalIdle = groups.reduce((sum, group) => sum + group.idleUsd, 0)
  const totalDebt = groups.reduce((sum, group) => sum + group.debtUsd, 0)
  return groups
    .filter((group) => group.usd > 0 || group.debtUsd > 0)
    .map((group) => ({
      ...group,
      share: total > 0 ? group.usd / total : 0,
      idleShare: totalIdle > 0 ? group.idleUsd / totalIdle : 0,
      debtShare: totalDebt > 0 ? group.debtUsd / totalDebt : 0,
    }))
}

export type PortfolioAllocation = ReturnType<typeof portfolioAllocation>

export function allocationDebtLabel(allocation: PortfolioAllocation): string {
  const assets = allocation.reduce((sum, group) => sum + group.usd, 0)
  const debt = allocation.reduce((sum, group) => sum + group.debtUsd, 0)
  if (!debt) return 'No debt'
  return assets > 0 ? `Debt: ${((debt / assets) * 100).toFixed(1)}% of assets` : 'Debt / assets: N/A (no assets)'
}

export function allocationIdleLabel(allocation: PortfolioAllocation): string {
  const assets = allocation.reduce((sum, group) => sum + group.usd, 0)
  const idle = allocation.reduce((sum, group) => sum + group.idleUsd, 0)
  return `Idle: ${assets > 0 ? ((idle / assets) * 100).toFixed(1) : '0.0'}% of assets`
}
