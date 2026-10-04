import type { LoadContext } from './loadContext'

// A position is a market + asset, merged across wallets and supply/borrow sides.
export function portfolioSummary(ctx: Pick<LoadContext, 'pools' | 'aavePositions' | 'compoundBorrowingInfo'>) {
  const protocols = new Set<string>()
  const chains = new Set<string>()
  const assets = new Set<string>()
  const positions = new Set<string>()
  function add(protocol: string, chain: string, market: string, asset: string) {
    protocols.add(protocol)
    chains.add(chain)
    assets.add(asset)
    positions.add(`${protocol}:${chain}:${market}:${asset}`)
  }
  for (const pool of ctx.pools) {
    if (pool.suppliedBN > 0n)
      add(pool.platform, pool.chain, pool.platform === 'AAVE' ? 'AAVE' : pool.borrowable.toLowerCase(), pool.asset)
  }
  for (const [userChain, position] of Object.entries(ctx.aavePositions)) {
    const chain = userChain.slice(42)
    for (const [asset, deposit] of [...Object.entries(position.collaterals), ...Object.entries(position.borrows)]) {
      if (deposit.bn > 0n) add('AAVE', chain, 'AAVE', asset)
    }
  }
  for (const [chain, markets] of Object.entries(ctx.compoundBorrowingInfo)) {
    for (const [market, entry] of Object.entries(markets)) {
      if (Object.values(entry.borrowed).some((d) => d.bn > 0n))
        add('Compound', chain, market.toLowerCase(), entry.asset)
      for (const [address, users] of Object.entries(entry.collaterals)) {
        if (Object.values(users).some((d) => d.bn > 0n))
          add('Compound', chain, market.toLowerCase(), entry.collateralToAsset[address])
      }
    }
  }
  return { protocols: protocols.size, chains: chains.size, assets: assets.size, positions: positions.size }
}
