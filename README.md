# Lending terminal

An advanced position management terminal for DeFi lending pools across multiple EVM chains.

## Features

- Shows current and virtual (that can be applied onchain) APR of pools.
- Deposit and withdraw directly from the app via wallet integration (Rabby, MetaMask, etc.).
- Shows combined data across multiple chains: BASE, OP, AVAX, SONIC, and WLD.
- Supports multiple lending protocols: Impermax, Tarot, AAVE, Compound, and Morpho.
- Tracked assets include USDC, ETH, wstETH, cbBTC, cbETH, AERO, OP, OX, COMP, SONIC, VELO, WLD, WBTC, and AVAX.
- Aggregated stats by asset and by chain, with per-address breakdowns.
- Merkl reward tracking for Morpho vaults.
- The app has no own backend and RPC requests are highly optimized. It's only 5 calls per chain to fetch all onchain data.
- CoinGecko API is used to fetch asset prices.
- Shows pools sorted by APR, filtered to those where your address has a stake or that meet APR/TVL thresholds.
- Supports tracking combined stats of multiple addresses (comma-separated in the input field).
- Stores input addresses in localStorage.
- Current list of supported pools: [constants.ts](src/constants/constants.ts).

## Stack

Vue 3 + TypeScript + Vite + PrimeVue
