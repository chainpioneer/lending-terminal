// Regression check with fixed $1 prices; no RPC or price API required.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'aave-check-'))
try {
  const outfile = join(directory, 'check.cjs')
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import assert from 'node:assert/strict';
        import { ASSETS, Chains, CHAIN_CONF, assetConf, getDiv } from './src/constants/constants';
        import { createLoadContext } from './src/logic/loadContext';
        import { processAaveBalances, buildAavePools } from './src/logic/processAave';
        const chain = Chains.MAINNET;
        const reserve = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        assert.equal(CHAIN_CONF[chain].assets[reserve], ASSETS.USDT);
        assert.equal(getDiv(ASSETS.USDT), 1e6);
        assert.equal(getDiv(ASSETS['PT-USDG-28MAY2026']), 1e6);
        assert.equal(getDiv(ASSETS.LBTC), 1e8);
        assert.equal(getDiv(ASSETS.tBTC), 1e18);
        for (const asset of Object.values(ASSETS)) {
          const conf = assetConf[asset];
          assert.ok(conf.tokenId || (conf.aave && CHAIN_CONF[conf.aave.chain].aaveOracle), asset);
        }
        const ctx = createLoadContext();
        ctx.cumulativeValuesByChains[chain] = {};
        ctx.aTokenInfo[chain] = {};
        // 10% supply APR; 20% borrow APR; 80% liquidation threshold.
        ctx.aaveReserveData[chain] = { [reserve]: [[8000n << 16n], 0n, 10n ** 26n, 0n, 2n * 10n ** 26n, 0n, 0n, 0n, 'aUSDT'] };
        processAaveBalances(ctx, chain, CHAIN_CONF[chain], ['alice', 'bob'], [reserve],
          [1000n * 10n**6n, 50n * 10n**6n, 8n * 10n**26n,
           100n * 10n**6n, 0n, 200n * 10n**6n, 50n * 10n**6n], 0, {}, {});
        assert.equal(ctx.suppliedByUser.alice, 100);
        assert.equal(ctx.suppliedByUser.bob, 150);
        assert.equal(ctx.aaveVDBalancesByAsset.USDT.usd, 50);
        assert.equal(ctx.aaveVDSpendingsByAsset.USDT.usd, 10);
        // Each user's earnings counted once: (100 + 200) * 10% / 365.
        assert.ok(Math.abs(ctx.cumulativeValuesByAsset.USDT.oldDailyEarnings / 1e6 - 30 / 365) < 1e-6);
        buildAavePools(ctx, chain, CHAIN_CONF[chain], [reserve]);
        assert.equal(ctx.pools[0].supplied, 300);
        assert.equal(ctx.pools[0].aprOld, 10);
        ctx.aTokenInfo[chain][reserve].supply.bn = 0n;
        buildAavePools(ctx, chain, CHAIN_CONF[chain], [reserve]);
        assert.equal(ctx.pools[1].utilization, 0);
        console.log('Aave decimals, prices configuration, multi-wallet accounting and zero supply: OK');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    plugins: [{
      name: 'fixed-prices',
      setup(build) {
        build.onLoad({ filter: /[/\\]assetPrices\.ts$/ }, () => ({
          contents: 'export const getAssetPrice = () => 1;', loader: 'js',
        }))
      },
    }],
  })
  execFileSync(process.execPath, [outfile], { stdio: 'inherit' })
} finally {
  await rm(directory, { recursive: true, force: true })
}
