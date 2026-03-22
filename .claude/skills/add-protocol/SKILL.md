---
name: add-protocol
description: Add a new DeFi lending protocol integration to the tracking app. Guides through contract analysis, data fetching, APR calculation, and UI wiring.
argument-hint: [protocol-name] [chain] [contract-address]
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
---

# Add Protocol Integration

You are integrating **$1** on **$2** chain with contract address **$3** into this lending terminal app.

## Architecture Overview

This app tracks user positions across multiple DeFi lending protocols. It uses ethcall (multicall batching) to fetch on-chain data in 4 batched calls per chain:
- **call1** (current block): Protocol state + user balances
- **call2** (current block): Collateral/AAVE data (only for Impermax/Compound/AAVE)
- **call3** (past block): Historical state for APR calculation
- **call4** (current block): Idle balances, LP data, lending protocol details

Each protocol integration follows the same pattern:
1. Add calls to `call1` in `load.ts`
2. Parse call1 results and push historical calls to `calls3`
3. Process call3 results to calculate APR
4. Push pool entries to `ctx.pools`

## Step-by-step Integration Checklist

### Step 0: Analyze the Contract

Before writing any code, understand the contract by:
1. Fetch source with `/fetch-contract $3 $2` or read the ABI
2. Identify the key functions:
   - **Asset**: What function returns the underlying token address? (e.g., `asset()`)
   - **TVL**: What returns total value locked? Be careful: `totalAssets()` in some ERC-4626 vaults only returns idle balance, NOT lent-out funds. Check if there's a `vaultInfo()` or similar that returns the real total.
   - **User balance**: How to convert user shares to asset value? Common patterns:
     - `shares * totalAssets / totalSupply` (standard ERC-4626)
     - `shares * exchangeRate / Q96` (Revert-style with X96 fixed-point)
     - `balanceOf()` returns asset amount directly (some protocols)
   - **APR source**: What changes over time to measure yield? Options:
     - Exchange rate change (totalAssets/totalSupply ratio, or explicit exchangeRate)
     - Interest rate from an interest rate model
     - Exchange rate stored in X96 format (e.g., `lendExchangeRateX96`)
   - **Utilization**: How to calculate? Usually `totalBorrowed / totalSupplied`
3. Call the contract with `cast call` to verify your understanding of the return values

### Step 1: Constants (`src/constants/constants.ts`)

**Add chain if needed:**
```typescript
export enum Chains {
  // ... existing chains
  NEW_CHAIN = 'NEW_CHAIN',
}
```

**Add block offset if chain has non-standard block times:**
Block time reference:
- Ethereum/Base/OP: ~2s → DEFAULT_PAST_BLOCK_OFFSET = 100 (~200s)
- Sonic: ~1s → SONIC_PAST_BLOCK_OFFSET = 1000 (~1000s)
- Arbitrum: ~0.25s → ARBITRUM_PAST_BLOCK_OFFSET = 4000 (~1000s)

Rule: target ~1000 seconds of historical data for accurate APR.

**Add protocol config to CHAIN_CONF type:**
```typescript
newProtocol?: {
  vaults: string[]          // vault/pool addresses
  // Add other config as needed (rewards URLs, etc.)
}
```

**Add chain entry to CHAIN_CONF** (if new chain):
```typescript
[Chains.NEW_CHAIN]: {
  borrowables: [],
  staking: {},
  aaveLendingPool: '',
  compoundBorrowings: [],
  newProtocol: {
    vaults: ['0x...'],
  },
  rpcUrls: ['https://...', 'https://...'],  // 3-4 RPCs for failover
  chainId: 12345,
  assets: {
    '0xTokenAddress': ASSETS.USDC,  // Map token addresses to ASSETS enum
  },
}
```

**Add new assets** to the `ASSETS` enum and `assetConf` if the protocol uses tokens not yet tracked.

### Step 2: Load Context (`src/logic/loadContext.ts`)

**Add pool entry type:**
```typescript
export type NewProtocolPoolEntry = {
  asset: ASSETS
  supplied: { [user: string]: Deposit }
  // Protocol-specific fields for TVL, exchange rates, etc.
  apr: number
  aggregatedDeposit: Deposit
}
```

**Add to LoadContext type and createLoadContext():**
```typescript
// In LoadContext type:
newProtocolPoolInfo: { [chain: string]: { [pool: string]: NewProtocolPoolEntry } }

// In createLoadContext():
newProtocolPoolInfo: {},
```

### Step 3: Process File (`src/logic/processNewProtocol.ts`)

Create a new file with two exported functions:

**`parseNewProtocolCall1Data()`** — Called after call1 multicall. Responsibilities:
- Read protocol data from call1 results using callIndex cursor
- Push historical calls to calls3 (for APR at past block)
- Calculate user balances and populate context maps
- MUST accumulate into these context maps for proper aggregation:
  - `ctx.suppliedByUser`
  - `ctx.suppliedByChainByUser`
  - `ctx.suppliedByAssetByUser`
  - `ctx.suppliedByChainByAssetByUser`
  - `ctx.suppliedByChainByBorrowableByUser` (for per-address breakdown in UI)
- Return updated callIndex

**`processNewProtocolPools()`** — Called after call3 multicall. Responsibilities:
- Read historical data from call3 results using cursor
- Calculate APR from exchange rate change: `((newRate - oldRate) * 365 * 24 * 3600 * 10000) / (timeDelta * oldRate) / 100`
- Calculate utilization, TVL
- Call `populateCumulativeByAsset()` for both `cumulativeValuesByAsset` and `cumulativeValuesByChains[chain]`
- Push pool entry to `ctx.pools`
- Return updated cursor

**Reference implementations:**
- Simple ERC-4626 vault: `processSpark.ts`
- ERC-4626 with rewards: `processMorpho.ts`
- ERC-4626 with vaultInfo exchange rate: `processRevert.ts`

### Step 4: Wire into Load (`src/logic/load.ts`)

**Import:**
```typescript
import newProtocolAbi from '../../abi/newProtocol.json' assert { type: 'json' }
import { parseNewProtocolCall1Data, processNewProtocolPools } from './processNewProtocol'
```

**Initialize context** in `callChain()`:
```typescript
ctx.newProtocolPoolInfo[chain] = {}
```

**Add to call1** (after spark/revert blocks):
```typescript
if (conf.newProtocol) {
  conf.newProtocol.vaults.forEach((address) => {
    const vault = new Contract(address, newProtocolAbi)
    calls1.push(vault.asset())
    calls1.push(vault.totalAssets())  // or vault.vaultInfo() etc.
    calls1.push(vault.totalSupply())
    users.forEach((addr) => {
      calls1.push(vault.balanceOf(addr))
    })
  })
}
```

**Parse call1 data** (after spark/revert parsing):
```typescript
if (conf.newProtocol) {
  nextCallIndex = parseNewProtocolCall1Data(ctx, chain, conf, users, call1Data, calls1, calls3, nextCallIndex)
}
```

**Process pools** (after spark/revert processing):
```typescript
if (conf.newProtocol) {
  cursor = await processNewProtocolPools(ctx, chain, conf, call3Data, cursor, blockTimestamp, timestamp, currentBlockNumber, pastBlockNumber)
}
```

### Step 5: Chain Mappings (`src/utils/chainMappings.ts`)

**If adding a new chain**, add entries to ALL these maps:
- `chainIdByChain` — hex chain ID (e.g., `'0xa4b1'`)
- `chainImgSrc()` — chain logo URL
- `linkToExplorer()` — block explorer domain
- `linkToPool()` — add chain to any relevant platform switch cases (Tarot, Impermax, AAVE)

**For the new protocol**, add:
- `platformImgSrc()` — protocol icon (use `https://icons.llama.fi/<protocol-name>.png` if available)
- `linkToPool()` — URL to the protocol's lending UI

### Step 6: Terminal Component (`src/components/Terminal.vue`)

**Update platform exclusion list** (line ~799) to avoid "Collateral:" prefix for non-collateral protocols:
```vue
!['AAVE', 'MORPHO', 'SPARK', 'REVERT', 'NEW_PROTOCOL'].includes(pool.platform)
```

### Step 7: Verify

1. Run `npx tsc --noEmit` — no type errors
2. Run `npx vite build` — clean build
3. Test with `npx vite dev` — verify pool card displays correctly:
   - Correct TVL (matches protocol UI)
   - Non-zero APR (matches protocol UI within ~1%)
   - Correct utilization percentage
   - Correct user balance
   - Working icon and pool link
   - Supply breakdown by addresses visible

## Common Pitfalls

1. **`totalAssets()` may not equal TVL**: In lending vaults, `totalAssets()` sometimes returns only idle (unlent) balance. Use protocol-specific info functions (e.g., `vaultInfo()`) to get the real total.

2. **Block time varies by chain**: Arbitrum ~0.25s, Sonic ~1s, Ethereum/L2s ~2s. The `DEFAULT_PAST_BLOCK_OFFSET = 100` targets ~200s. For fast chains, increase the offset to get ~1000s of history.

3. **timeDelta fallback is inaccurate**: For chains without Impermax/Tarot borrowables, `timestamp` stays 0 and timeDelta falls back to `(blockOffset) * 2`. This assumes 2s blocks — wrong for Arbitrum/Sonic. Fix: fetch past block timestamp with `web3EthCall(chain, 'getBlock', [pastBlockNumber, false])` for chains with `!conf.borrowables.length`.

4. **X96 fixed-point math**: Some protocols use Q96 (2^96) fixed-point for exchange rates. Convert with: `value * amount / (2n ** 96n)`.

5. **`call1Data.pop()` for AAVE**: The AAVE reserves list is retrieved via `pop()` on call1Data. If your protocol's calls come AFTER AAVE's `getReservesList()` in call1, the pop will remove YOUR data, not AAVE's. Currently safe because no chain has both AAVE and vault protocols, but beware if combining them.

6. **Supply breakdown requires `suppliedByChainByBorrowableByUser`**: If you forget to accumulate into this map, the per-address breakdown won't show in the UI.

7. **Icon URLs**: Use `curl -sI <url>` to verify the content-type is `image/png` or `image/svg+xml`. HTML responses (like SPA redirects) won't render as icons. DefiLlama icons at `https://icons.llama.fi/<protocol>.png` are reliable.
