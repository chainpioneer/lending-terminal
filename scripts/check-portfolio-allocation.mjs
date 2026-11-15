import { build } from 'esbuild'
import assert from 'node:assert/strict'

const result = await build({ entryPoints: ['src/logic/portfolioAllocation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { portfolioAllocation, allocationDebtLabel, allocationIdleLabel } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
const empty = portfolioAllocation({}, {})
assert.deepEqual(empty, [])
const allocation = portfolioAllocation({
  USDC: { alice: { usd: 100 }, bob: { usd: 50 } },
  sDAI: { alice: { usd: 25 } },
  'PT-sUSDE-27NOV2025': { alice: { usd: 25 } },
  ETH: { alice: { usd: 80 } }, WETH: { bob: { usd: 20 } },
  WBTC: { alice: { usd: 50 } }, cbBTC: { bob: { usd: 50 } },
  wstETH: { alice: { usd: 70 } }, AERO: { bob: { usd: 30 } },
  UNKNOWN: { alice: { usd: 0 }, bob: { usd: -10 }, carol: { usd: NaN }, dave: { usd: Infinity } },
}, {})
assert.deepEqual(allocation.map(g => g.usd), [200, 100, 100, 100])
assert.deepEqual(allocation.map(g => g.share), [0.4, 0.2, 0.2, 0.2])
assert.equal(portfolioAllocation({ USDT: { alice: { usd: 0.01 } } }, {})[0].share, 1)
assert.equal(portfolioAllocation({ UNKNOWN: { alice: { usd: 10 } } }, {})[0].share, 1)
console.log('Portfolio allocation: value weighting, multiple wallets, wrappers, stables, empty and invalid values: OK')

const withIdle = portfolioAllocation(
  { ETH: { alice: { usd: 100 } }, USDC: { alice: { usd: 100 } } },
  { ETH: { alice: { usd: 50 }, bob: { usd: 50 } }, USDC: { bob: { usd: 100 } } },
)
assert.deepEqual(withIdle.map(({ label, usd, share }) => ({ label, usd, share })), [
  { label: 'Stables', usd: 200, share: 0.5 },
  { label: 'ETH', usd: 200, share: 0.5 },
])
assert.deepEqual(portfolioAllocation({}, { cbBTC: { alice: { usd: 100 } } }).map(g => [g.label, g.share]), [['BTC', 1]])
console.log('Idle balances included once across wallets; zero categories omitted: OK')

const leveraged = portfolioAllocation(
  { ETH: { alice: { usd: 1000 } }, USDC: { alice: { usd: 100 } } },
  { USDC: { alice: { usd: 400 } } },
  [{ USDC: { usd: 200 }, WBTC: { usd: 100 } }, { USDC: { usd: 100 } }],
)
assert.deepEqual(leveraged.map(g => [g.label, g.usd, g.debtUsd, g.share, g.debtShare]), [
  ['Stables', 500, 300, 1 / 3, 0.75],
  ['ETH', 1000, 0, 2 / 3, 0],
  ['BTC', 0, 100, 0, 0.25],
])
assert.equal(allocationDebtLabel(leveraged), 'Debt: 26.7% of assets')
assert.equal(allocationDebtLabel(allocation), 'No debt')
assert.equal(allocationDebtLabel(empty), 'No debt')
const debtOnly = portfolioAllocation({}, {}, [{ USDC: { usd: 100 } }])
assert.equal(debtOnly[0].share, 0)
assert.equal(debtOnly[0].debtShare, 1)
assert.equal(allocationDebtLabel(debtOnly), 'Debt / assets: N/A (no assets)')
assert.equal(allocationDebtLabel(portfolioAllocation({ ETH: { alice: { usd: 100 } } }, {}, [{ USDC: { usd: 150 } }])), 'Debt: 150.0% of assets')
assert.deepEqual(portfolioAllocation({}, {}, [{ ETH: { usd: NaN }, USDC: { usd: -1 } }]), [])
console.log('Independent asset/debt rings, debt-only categories, protocol aggregation, no assets and debt above assets: OK')

assert.deepEqual(withIdle.map(g => [g.label, g.idleUsd, g.idleShare]), [
  ['Stables', 100, 0.5], ['ETH', 100, 0.5],
])
assert.deepEqual(leveraged.map(g => g.idleShare), [1, 0, 0])
assert.equal(leveraged.reduce((sum, g) => sum + g.usd, 0), 1500, 'Idle is not double counted in total assets')
assert.ok(allocation.every(g => g.idleUsd === 0 && g.idleShare === 0))
const idleOnly = portfolioAllocation({}, { WETH: { alice: { usd: 100 } }, cbBTC: { bob: { usd: 300 } } })
assert.deepEqual(idleOnly.map(g => [g.share, g.idleShare]), [[0.25, 0.25], [0.75, 0.75]])
console.log('Idle ring: independent proportions, multiple wallets, no idle and idle-only portfolio: OK')

assert.equal(allocationIdleLabel(leveraged), 'Idle: 26.7% of assets')
assert.equal(allocationIdleLabel(idleOnly), 'Idle: 100.0% of assets')
assert.equal(allocationIdleLabel(empty), 'Idle: 0.0% of assets')
