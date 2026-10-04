# Adding an integration

Start with one real market and a reproducible position. Explain which number is missing from other trackers and how this integration calculates it.

## Another market on an existing integration

1. Add the market/vault/reserve to the appropriate chain in [`CHAIN_CONF`](src/constants/constants.ts). Use the address casing returned by contracts: several lookups are case-sensitive.
2. Map underlying, collateral and reward tokens in that chain's `assets`. A new symbol also needs `ASSETS`, `assetConf` (a DefiLlama CoinGecko ID or a canonical Aave oracle source) and explicit `decimals` for non-18-decimal tokens. Existing decimal overrides in `getDiv` remain supported.
3. Check the matching `process*.ts` assumptions before assuming ABI compatibility. A vault being ERC-4626-like does not make its yield/reward logic identical.

For example, this is the existing Base Extra Finance configuration, inside `CHAIN_CONF[Chains.BASE]`:

```ts
extra: {
  lendingPool: '0xBB505c54D71E9e599cB8435b4F0cEEc05fC71cbD',
  reserveIds: [25], // USDC
},
```

Adding a verified reserve ID here reuses the current processor, provided its underlying is mapped and it has the same rate/position semantics. This does not add reward support automatically.

## A new contract shape

There is no adapter interface or auto-registration. Follow the explicit call/parse flow:

| File | Change |
| --- | --- |
| `abi/` | Add the ABI methods actually used. |
| `src/constants/constants.ts` | Extend the `CHAIN_CONF` type and configure one chain/market plus its assets. |
| `src/logic/load.ts` | Append calls to the appropriate stage and invoke your parser/processor in matching order. |
| `src/logic/processYourProtocol.ts` | Convert balances/rates and fill the existing aggregates and pool rows. |
| `src/logic/loadContext.ts` | Add intermediate state only if the integration needs it. A context is created per fetch. |
| `src/types.ts` | Reuse `Pool` and `Deposit`; change shared types only for data the UI needs. |
| `src/utils/chainMappings.ts` | Add protocol icon and pool URL handling; add network mappings for a new chain. |
| `src/components/Terminal.vue` | Check labels and protocol-specific rendering. The pool-kind exclusion list needs updating for non-Impermax/Tarot pools. |

[`processExtra.ts`](src/logic/processExtra.ts) is the smallest complete supply integration: one batch layout, balance conversion, net supply APR, per-wallet totals, cumulative earnings and a `Pool` row. [`processRevert.ts`](src/logic/processRevert.ts) shows the historical-rate pattern.

### Things that are easy to get wrong

- **Call order is a contract.** `load.ts` builds flat arrays; processors consume them with cursors. Account for every market and every user. Return the next cursor where subsequent parsers need it. `tryAll` results can be null.
- **Keep units explicit.** `Deposit.bn` is an underlying-token integer, `amount` is human units, `usd` is priced. Use [`depositUtils.ts`](src/utils/depositUtils.ts) for conversion and accumulation. `populateCumulativeByAsset` expects token base-unit amounts and base-unit daily earnings; `Pool` display fields use human units.
- **Populate the breakdowns too.** Supply totals need per-user, per-chain, per-asset and per-pool maps, not just `ctx.pools`. Missing maps can leave a plausible pool card alongside wrong totals.
- **Explain the rate.** Document fee treatment, seconds/year, sampling window and whether a value is APR, APY or an incentive estimate. Use `aprOld === aprNew` when there is no simulated update. Do not invent capacity/utilization for a vault that doesn't expose them.
- **Handle empty and failing data.** Zero supply, no user deposit, missing prices, failed historical reads and unknown reward tokens need deliberate behavior. Existing processors aren't a guarantee that all those cases are handled correctly.
- **Reading and transacting are separate.** `router.ts` and the UI enable transactions only for configured Impermax/Tarot routers. A new tracking integration does not need transaction support.

## Verify and send a PR

Use the setup commands in the [README](README.md#running-locally), then run:

```sh
npx --yes yarn@1.22.22 lint
npx --yes yarn@1.22.22 build
```

Compare one known position against direct contract reads or the protocol UI at a recorded block/time. Check an address with no position and a multi-address fetch; confirm the totals and breakdowns reconcile. If adding calculations, include a small reproducible check with fixed inputs and expected units/results. Run `npm run test:aave` for the offline Aave regression check (decimals, multi-wallet earnings/debt and zero-supply reserves).

In the PR, include the chain, contract/reserve addresses, data source for each rate/reward, reproduction steps and limitations. Update the README coverage table. Partial, clearly described coverage is fine. A protocol logo alone isn't an integration.
