# Unsupported Terminal

A personal DeFi lending position tracker. Built in public, supported for nobody.

This project exists to track **my own** lending positions across EVM chains. It's open source because GitHub gives me free hosting. If it works for you — great. If it doesn't — that's expected.

I make no guarantees that any integrated protocol is fully or correctly supported. I only guarantee it works for **my** positions at any given moment.

## What it does

- Tracks lending pool APR (current and virtual) across multiple chains and protocols.
- Deposit and withdraw via wallet integration (EIP-6963: Rabby, MetaMask, etc.).
- Aggregated stats by asset and by chain, with per-address breakdowns.
- Reward tracking: Merkl campaigns (Morpho), Spark rewards API, Compound COMP accrual.
- No backend. RPC calls batched via Multicall3 — ~5 calls per chain for all onchain data.
- Asset prices from DefiLlama (CoinGecko IDs) with DexScreener fallback.
- Pools sorted by APR, filtered by your positions or APR/TVL thresholds.
- Multi-address tracking (comma-separated, persisted in localStorage).
- Pool list: [constants.ts](src/constants/constants.ts).

## Chains

Mainnet, Base, Optimism, Avalanche, Sonic, World Chain, Arbitrum, Gnosis.

## Protocols

Impermax, Tarot, AAVE v3, Compound, Morpho Blue, Spark, Revert Finance.

Not all protocols are active on all chains. It's expected it will not work correctly for borrowing positions that aren't mine. Check the [constants](src/constants/constants.ts) for the actual wiring.

## Assets

USDC, ETH, wstETH, cbBTC, cbETH, WBTC, AERO, VELO, OP, OX, COMP, SONIC, WLD, AVAX, XDAI.

## Stack

Vue 3 + TypeScript + Vite + PrimeVue + ethers + ethcall (Multicall3)

Deployed to GitHub Pages.
