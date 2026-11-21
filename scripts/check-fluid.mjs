// Offline regression check; resolver responses captured via mainnet multicall at the fixture block.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'fluid-check-'))
try {
  const outfile = join(directory, 'check.mjs')
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import assert from 'node:assert/strict';
        import { Interface } from 'ethers';
        import Abi from './node_modules/ethcall/dist/abi.js';
        import fixture from './scripts/fixtures/fluid-onchain.json';
        import vault24Fixture from './scripts/fixtures/fluid-vault24.json';
        import vaultAbi from './abi/FluidVaultResolver.json';
        import dexAbi from './abi/FluidDexResolver.json';
        import { Contract } from 'ethcall';
        import { CHAIN_CONF, Chains } from './src/constants/constants';
        import { parseFluidPositions, applyFluidPositions, fluidDexAddresses } from './src/logic/processFluid';
        import { createLoadContext } from './src/logic/loadContext';
        import { portfolioSummary } from './src/logic/portfolioSummary';
        import { portfolioAllocation } from './src/logic/portfolioAllocation';
        import load from './src/logic/load';
        import { setCallHandler, recordedCalls } from './src/provider/provider';
        const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
        // Exercise the same ABI decoding as ethcall, including named nested tuples and signed rates.
        const decode = (abi, name, values) => Abi.decode(name, abi.find(a => a.name === name).outputs,
          new Interface(abi).encodeFunctionResult(name, values));
        const raw = fixture.positions.map(p => decode(vaultAbi, 'positionByNftId', p).map(v => v.toObject(true)));
        const vault24Data = decode(vaultAbi, 'positionByNftId', vault24Fixture.position);
        const [vault24] = parseFluidPositions([vault24Data], {});
        assert.equal(vault24.vault, '24');
        assert.equal(vault24.healthFactor, '1.347');
        assert.equal(vault24Data[1].vault, '0x991416539E9DA46db233bCcbaEA38C4f852776D4');
        assert.equal(vault24.supply[0].asset, 'ETH');
        assert.equal(vault24.borrow[0].asset, 'WBTC');
        close(vault24.supply[0].amount, Number(vault24Data[0].supply) / 1e18);
        close(vault24.borrow[0].amount, Number(vault24Data[0].borrow) / 1e8);
        close(vault24.equity, vault24.supply[0].amount * 1000 - vault24.borrow[0].amount * 50000);
        const dexes = Object.fromEntries(Object.entries(fixture.dexes).map(([address, data]) =>
          [address, decode(dexAbi, 'getDexEntireData', [data])[0].toObject(true)]));
        const resolver = new Contract(CHAIN_CONF.MAINNET.fluid.vaultResolver, vaultAbi);
        assert.equal(resolver.positionsNftIdOfUser(raw[0][0].owner).name, 'positionsNftIdOfUser');
        assert.equal(resolver.positionByNftId(4223n).params[0], 4223n);
        assert.deepEqual([...decode(vaultAbi, 'positionsNftIdOfUser', [fixture.empty])[0]], []);
        const dexResolver = new Contract(CHAIN_CONF.MAINNET.fluid.dexResolver, dexAbi);
        assert.equal(dexResolver.getDexEntireData(Object.keys(dexes)[0]).name, 'getDexEntireData');
        assert.deepEqual(fluidDexAddresses(raw).sort(), Object.keys(dexes).sort());
        assert.equal(fluidDexAddresses([...raw, ...raw]).length, Object.keys(dexes).length);
        const positions = parseFluidPositions(raw, dexes);
        assert.equal(positions.length, 4);
        assert.deepEqual(positions.map(p => p.healthFactor), ['7.182', '4.034', '1.774', '3.096']);
        assert.deepEqual(positions.map(p => [p.supply.length, p.borrow.length]), [[1,1],[2,1],[1,2],[2,2]]);
        const real = positions[0];
        assert.equal(raw[0][1].vault, '0xF140Ea1C1D657EaaB802FF7626dC220cD4007CE7');
        close(real.supply[0].amount, Number(raw[0][0].supply) / 1e6);
        close(real.borrow[0].amount, Number(raw[0][0].borrow) / 1e8);
        for (const p of positions) {
          const value = legs => legs.reduce((sum,l) => sum + l.usd,0);
          const income = legs => legs.reduce((sum,l) => sum + l.usd*l.apr/36500,0);
          close(p.equity, value(p.supply)-value(p.borrow));
          close(p.daily, income(p.supply)-income(p.borrow));
        }
        const [nft, vault] = raw[0];
        const testVault = { ...vault, exchangePricesAndRates: { supplyRateVault: 1000n, borrowRateVault: 2000n } };
        const testNft = { ...nft, owner:'alice', supply:1000000000n, borrow:1000000n };
        const [position] = parseFluidPositions([[testNft, testVault]], {});
        close(position.equity, 500);
        close(position.daily, 0);
        // 1000 USDC, 0.01 WBTC: oracle values collateral at 0.02 WBTC; 80% threshold gives HF 1.6.
        const riskVault = { ...testVault, configs: { liquidationThreshold:8000n, oraclePriceLiquidate:2n*10n**24n, oraclePriceOperate:9n*10n**24n } };
        const health = overrides => parseFluidPositions([[{...testNft,...overrides},riskVault]], {})[0].healthFactor;
        assert.equal(health({}), '1.600');
        assert.equal(health({borrow:1600000n}), '1.000');
        assert.equal(health({borrow:2000000n}), '0.800');
        assert.equal(health({borrow:0n}), '∞');
        assert.equal(health({supply:0n}), '0.000');
        assert.equal(parseFluidPositions([[testNft,{...riskVault,configs:{...riskVault.configs,oraclePriceLiquidate:0n}}]], {})[0].healthFactor, '—');
        assert.deepEqual(parseFluidPositions([], {}), []);
        assert.deepEqual(parseFluidPositions([[{...testNft,supply:0n,borrow:0n},testVault]], {}), []);
        assert.deepEqual(parseFluidPositions([[{...testNft,borrow:0n},testVault]], {})[0].borrow, []);
        assert.throws(() => parseFluidPositions([[{...testNft,supply:-1n},testVault]], {}));
        assert.throws(() => parseFluidPositions([raw[1]], {}), /Missing Fluid DEX/);
        const unknown = { ...testVault, constantVariables: { ...vault.constantVariables, supplyToken: {token0:'0x0000000000000000000000000000000000000001'} } };
        assert.throws(() => parseFluidPositions([[testNft,unknown]], {}), /Unknown Fluid asset/);
        // A negative smart-debt vault rate reduces debt cost; share balances are already interest-adjusted.
        const smartVault = { ...raw[2][1], exchangePricesAndRates: { supplyRateVault:0n, borrowRateVault:-1000n } };
        const smartDexAddress = smartVault.constantVariables.borrow;
        const smartDex = { ...dexes[smartDexAddress], dexState: { token0PerBorrowShare:500000000n, token1PerBorrowShare:500000000n },
          limitsAndAvailability: {liquidityTokenData0:{borrowRate:200n},liquidityTokenData1:{borrowRate:300n}} };
        const smart = parseFluidPositions([[{...raw[2][0],supply:0n,borrow:10n**18n},smartVault]], {...dexes,[smartDexAddress]:smartDex})[0];
        assert.deepEqual(smart.borrow.map(l => l.amount), [500,500]);
        assert.deepEqual(smart.borrow.map(l => l.apr), [-8,-7]);
        const ctx = createLoadContext();
        ctx.cumulativeValuesByChains.MAINNET = {};
        ctx.chainAggregatedStats.MAINNET = { newUserSuppliedUsd: 0, oldDailyEarningsUsd: 0, maxDailyEarningsUsd: 0, currentAPR: 0, maxAPR: 0, usd: 0 };
        const wallets = [position, { ...position, user: 'bob', id: 'second' }];
        const debts = applyFluidPositions(ctx, wallets);
        assert.equal(ctx.cumulativeValuesByAsset.USDC.newUserSuppliedUsd, 2000);
        assert.equal(ctx.cumulativeValuesByChains.MAINNET.USDC.newUserSupplied, 2000);
        assert.equal(ctx.suppliedByUser.alice, 1000);
        assert.equal(ctx.suppliedByChainByAssetByUser.MAINNET.USDC.bob.amount, 1000);
        close(ctx.chainAggregatedStats.MAINNET.oldDailyEarningsUsd, 200 / 365);
        assert.equal(debts.WBTC.usd, 1000);
        assert.deepEqual(portfolioSummary(ctx, wallets), { protocols: 1, chains: 1, assets: 2, positions: 2 });
        const allocation = portfolioAllocation(ctx.suppliedByAssetByUser, {}, [debts]);
        assert.equal(allocation.find(x => x.label === 'BTC').debtUsd, 1000);
        // Run the real loader with deterministic RPC replies to check batch offsets and completion timing.
        for (const conf of Object.values(CHAIN_CONF)) {
          Object.assign(conf, { borrowables: [], staking: {}, compoundBorrowings: [], aaveLendingPool: '', morpho: undefined, spark: undefined, revert: undefined, extra: undefined });
        }
        const wallet = nft.owner.toLowerCase();
        setCallHandler(call => {
          if (call.name === 'positionsNftIdOfUser') return call.params[0] === wallet ? raw.map(p => p[0].nftId) : [];
          if (call.name === 'positionByNftId') return raw.find(p => p[0].nftId === call.params[0]);
          if (call.name === 'getDexEntireData') return dexes[call.params[0]];
          if (call.name === 'ethBalance') return 0n;
          throw new Error('Unexpected RPC call ' + call.name);
        });
        const originalLog = console.log;
        const originalFetch = globalThis.fetch;
        console.log = () => {};
        globalThis.fetch = () => { throw new Error('Fluid must not fetch HTTP API data'); };
        try {
          const result = await load([wallet, '0x0000000000000000000000000000000000000001'], chain => {
            if (chain === Chains.MAINNET) assert.ok(recordedCalls.some(b => b.calls.some(c => c.name === 'getDexEntireData')));
          });
          assert.equal(result.fluidPositions.length, 4);
          assert.ok(result.fluidPositions.every(p => p.user === wallet));
          close(Number(result.totalDeposited), Number(positions.reduce((sum,p) => sum+p.equity,0).toFixed(2)));
          close(result.netDailyEarningsUsd, positions.reduce((sum,p) => sum+p.daily,0));
          const fluidBatches = recordedCalls.filter(b => b.calls.some(c => /positionsNftIdOfUser|positionByNftId|getDexEntireData/.test(c.name)));
          assert.equal(fluidBatches.length, 3);
          assert.ok(fluidBatches.every(b => b.chain === Chains.MAINNET && b.block === 100000));
          const empty = await load(['0x0000000000000000000000000000000000000001']);
          assert.deepEqual(empty.fluidPositions, []);
        } finally {
          console.log = originalLog;
          globalThis.fetch = originalFetch;
        }
        console.log('Fluid on-chain ABI, empty wallets, vaults 24/101, T1-T4 shares, signed APR and portfolio accounting: OK');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    outfile,
    plugins: [
      {
        name: 'fixed-prices',
        setup(build) {
          build.onLoad({ filter: /assetPrices\.ts$/ }, () => ({
            contents:
              'export const waitForPrices = async () => {}; export const getAssetPrice = asset => ({ WBTC: 50000, cbBTC: 50000, ETH: 1000, wstETH: 1200 }[asset] ?? 1);',
            loader: 'js',
          }))
          build.onLoad({ filter: /provider\/provider\.ts$/ }, () => ({
            contents: `
              let handler;
              export const recordedCalls = [];
              export const setCallHandler = fn => { handler = fn; };
              export const callWithTimeout = async (chain, calls, block) => {
                recordedCalls.push({ chain, calls, block });
                return calls.map(handler);
              };
              export const tryWithTimeout = callWithTimeout;
              export const web3EthCall = async () => ({ number: 100000n, timestamp: 1700000000n });
              export const getCurrentEthCallProvider = () => ({ getEthBalance: user => ({ name: 'ethBalance', params: [user] }) });
            `,
            loader: 'js',
          }))
        },
      },
    ],
  })
  execFileSync(process.execPath, [outfile], { stdio: 'inherit' })
} finally {
  await rm(directory, { recursive: true, force: true })
}
