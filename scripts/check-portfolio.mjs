import { build } from 'esbuild'
import assert from 'node:assert/strict'

const result = await build({ entryPoints: ['src/logic/portfolioSummary.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { portfolioSummary } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
const deposit = { bn: 1n }
const ctx = { pools: [], aavePositions: {}, compoundBorrowingInfo: {} }
assert.deepEqual(portfolioSummary(ctx), { protocols: 0, chains: 0, assets: 0, positions: 0 })
ctx.pools = [
  { platform: 'AAVE', chain: 'MAINNET', asset: 'ETH', suppliedBN: 1n, borrowable: 'aETH' },
  { platform: 'Spark', chain: 'GNOSIS', asset: 'DAI', suppliedBN: 0n, borrowable: 'vault' },
]
for (const user of ['0x' + '1'.repeat(40), '0x' + '2'.repeat(40)]) {
  ctx.aavePositions[user + 'MAINNET'] = { collaterals: { ETH: deposit }, borrows: { ETH: deposit, USDT: deposit } }
}
assert.deepEqual(portfolioSummary(ctx), { protocols: 1, chains: 1, assets: 2, positions: 2 })
ctx.compoundBorrowingInfo.BASE = { market: { asset: 'USDT', borrowed: { alice: deposit }, collaterals: { token: { alice: deposit } }, collateralToAsset: { token: 'ETH' } } }
ctx.pools.push({ platform: 'Spark', chain: 'GNOSIS', asset: 'DAI', suppliedBN: 1n, borrowable: 'vault' })
assert.deepEqual(portfolioSummary(ctx), { protocols: 3, chains: 3, assets: 3, positions: 5 })
console.log('Portfolio counts: empty, multi-wallet deduplication, debt-only assets, unfiltered positions: OK')
