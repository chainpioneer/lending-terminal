import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

// Exercise the actual aggregation block with fixed prices and no network calls.
const source = await readFile('src/logic/load.ts', 'utf8')
const block = source.slice(source.indexOf('  let totalDeposited = 0'), source.indexOf('  // === Sort and filter ==='))
const apr = source.slice(source.indexOf('  const currentAPR ='), source.indexOf('  const res ='))
const { code } = await transform(`export function aggregate(ctx) {
  const ASSETS = { USD: 'USD' };
  const getAssetPrice = () => 1;
  const getDiv = () => 1;
  const formatStats = ca => [ca.newUserSupplied, ca.oldDailyEarnings, ca.newDailyEarnings, ca.maxDailyEarnings];
  ${block}
  ${apr}
  return { totalDeposited, oldTotalEarnings, newTotalEarnings, maxTotalEarnings, currentAPR, aprWithIdle };
}`, { loader: 'ts', format: 'esm' })
const { aggregate } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
function context(morpho, spark, supplied = 1100) {
  return {
    compoundBorrowingReward: { usd: 365 }, morphoRewardTotalUsd: morpho, sparkRewardTotalUsd: spark,
    cumulativeValuesByAsset: { USD: { newUserSupplied: supplied, oldDailyEarnings: 10, newDailyEarnings: 12, maxDailyEarnings: 12 } },
    aaveVDBalancesByAsset: { USD: { usd: 100 } }, compoundDebtByAsset: {},
    aaveVDSpendingsByAsset: { USD: { usd: 365 } }, compoundSpendingsByAsset: {}, idleBalancesByAsset: {},
  }
}
const baseline = aggregate(context(0, 0))
const rewarded = aggregate(context(2, 3))
assert.equal(rewarded.totalDeposited, 1000)
for (const key of ['oldTotalEarnings', 'newTotalEarnings', 'maxTotalEarnings']) {
  assert.equal(rewarded[key] - baseline[key], 5, `${key}: rewards included exactly once per day`)
}
assert.equal(rewarded.oldTotalEarnings, 15)
assert.equal(rewarded.currentAPR, '547.50')
assert.equal(aggregate(context(2, 3, 100)).currentAPR, '0')
assert.equal(aggregate(context(2, 3, 0)).currentAPR, '0')
console.log('Portfolio rewards: daily units, all earnings variants, borrowing costs and nonpositive capital: OK')

const halfIdle = context(2, 3)
halfIdle.idleBalancesByAsset = { USD: { usd: 1000 } }
assert.equal(aggregate(halfIdle).aprWithIdle, '273.75')
assert.equal(rewarded.aprWithIdle, rewarded.currentAPR)
assert.equal(aggregate(context(2, 3, 100)).aprWithIdle, null)
assert.equal(aggregate(context(2, 3, 0)).aprWithIdle, null)
const rescued = context(2, 3, 0)
rescued.idleBalancesByAsset = { USD: { usd: 1100 } }
assert.equal(aggregate(rescued).aprWithIdle, '547.50')
const negativeYield = context(-20, 0)
negativeYield.idleBalancesByAsset = { USD: { usd: 1000 } }
assert.equal(aggregate(negativeYield).aprWithIdle, '-182.50')
console.log('APR including idle: shared earnings, debt-adjusted capital, zero/negative denominator and negative yield: OK')
