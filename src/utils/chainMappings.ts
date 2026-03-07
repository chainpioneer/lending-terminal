import { ASSETS, Chains } from '../constants/constants'

export const chainIdByChain: { [ch in Chains]: string } = {
  [Chains.SCROLL]: '0x82750',
  [Chains.OP]: '0xa',
  [Chains.FTM]: '0xfa',
  [Chains.BLAST]: '0x13e31',
  [Chains.BASE]: '0x2105',
  [Chains.SONIC]: '0x92',
  [Chains.AVAX]: '0xa86a',
  [Chains.WLD]: '0x1e0',
}

export function chainImgSrc(ch: number | string) {
  switch (ch) {
    case Chains.FTM:
      return 'https://res.coinpaper.com/coinpaper/fantom_ftm_logo_5b62819c57.png'
    case Chains.BLAST:
      return 'https://cdn.prod.website-files.com/65a6baa1a3f8ed336f415cb4/65a6cc95aae1066cf96d497d_Logo%20Black%20on%20Yellow%20Background%402x.png'
    case Chains.BASE:
      return 'https://avatars.githubusercontent.com/u/108554348?v=4'
    case Chains.OP:
      return 'https://zengo.com/wp-content/uploads/Optimism.png'
    case Chains.SCROLL:
      return 'https://img.cryptorank.io/coins/scroll1693474620599.png'
    case Chains.SONIC:
      return 'https://img.cryptorank.io/coins/sonic1722608075138.png'
    case Chains.AVAX:
      return 'https://static.vecteezy.com/system/resources/previews/011/307/278/non_2x/avalanche-avax-badge-crypto-isolated-on-white-background-blockchain-technology-3d-rendering-free-png.png'
    case Chains.WLD:
      return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMnTSr79HmlkL1WANLFB9i-dbM8Y-PpPxnEQ&s'
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

export function assetImgSrc(asset: number | string) {
  switch (asset) {
    case ASSETS.FTM:
      return chainImgSrc(Chains.FTM)
    case ASSETS.AVAX:
      return chainImgSrc(Chains.AVAX)
    case ASSETS.WLD:
      return chainImgSrc(Chains.WLD)
    case 'fBOMB':
      return 'https://whattofarm.io/assets/dex/tokens/200/fbomb-bomb-logo.webp'
    case ASSETS.OP:
      return chainImgSrc(Chains.OP)
    case ASSETS.SONIC:
      return chainImgSrc(Chains.SONIC)
    case ASSETS.IBEX:
      return 'https://icons.llama.fi/impermax-finance.png'
    case ASSETS.wstETH:
      return 'https://assets.gemwallet.com/blockchains/ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png'
    case ASSETS.USDC:
      return 'https://png.pngtree.com/png-vector/20220709/ourmid/pngtree-usd-coin-usdc-digital-stablecoin-icon-technology-pay-web-vector-png-image_37843734.png'
    case ASSETS.cbBTC:
      return 'https://s2.coinmarketcap.com/static/img/coins/200x200/32731.png'
    case ASSETS.cbETH:
      return 'https://res.coinpaper.com/coinpaper/cbeth_kfal8a.png'
    case ASSETS.AERO:
      return 'https://s2.coinmarketcap.com/static/img/coins/200x200/29270.png'
    case ASSETS.VELO:
      return 'https://img.cryptorank.io/exchanges/150x150.velodrome_v_21704966248564.png'
    case ASSETS.ETH:
      return 'https://seeklogo.com/images/E/ethereum-logo-EC6CDBA45B-seeklogo.com.png'
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

export function platformImgSrc(platform: string) {
  switch (platform) {
    case 'Impermax':
      return assetImgSrc(ASSETS.IBEX)
    case 'Tarot':
      return 'https://www.tarot.to/favicon.ico'
    case 'MORPHO':
      return 'https://s2.coinmarketcap.com/static/img/coins/200x200/34104.png'
    case 'AAVE':
      return 'https://cdn.freelogovectors.net/wp-content/uploads/2021/12/aavelogo-freelogovectors.net_.png'
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

export function linkToPool(pool: { vault: string; platform: string; chain: Chains; stable: boolean }) {
  switch (pool.platform) {
    case 'Tarot': {
      let chainId
      switch (pool.chain) {
        case Chains.BASE:
          chainId = '8453'
          break
        case Chains.SCROLL:
          chainId = '534352'
          break
        case Chains.OP:
          chainId = '10'
          break
        case Chains.FTM:
          chainId = '250'
          break
        case Chains.SONIC:
          chainId = '146'
          break
        case Chains.AVAX:
          chainId = '43114'
          break
        case Chains.WLD:
          chainId = '480'
          break
        default:
          throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://tarot.to/lending-pool/${chainId}/${pool.vault.toLowerCase()}`
    }
    case 'Impermax': {
      let chainPrefix
      switch (pool.chain) {
        case Chains.BASE:
          chainPrefix = 'base'
          break
        case Chains.SCROLL:
          chainPrefix = 'scroll'
          break
        case Chains.OP:
          chainPrefix = 'optimism'
          break
        case Chains.FTM:
          chainPrefix = 'fantom'
          break
        case Chains.BLAST:
          chainPrefix = 'blast'
          break
        case Chains.SONIC:
          chainPrefix = 'sonic'
          break
        case Chains.AVAX:
          chainPrefix = 'avalanche'
          break
        default:
          throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://${chainPrefix}.impermax.finance/lending-pool/${typeof pool.stable === 'boolean' ? (pool.stable ? '7' : '6') : '4'}/${pool.vault.toLowerCase()}`
    }
    case 'AAVE': {
      let chainName
      switch (pool.chain) {
        case Chains.BASE:
          chainName = 'base'
          break
        case Chains.SCROLL:
          chainName = 'scroll'
          break
        case Chains.OP:
          chainName = 'optimism'
          break
        default:
          throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://app.aave.com/?marketName=proto_${chainName}_v3`
    }
    case 'MORPHO': {
      let cName
      switch (pool.chain) {
        case Chains.WLD:
          cName = 'world-chain'
          break
        default:
          throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://lite.morpho.org/${cName}/earn`
    }
    default:
      throw new Error(`Unknown platform ${pool.platform}`)
  }
}

export function linkToExplorer(pool: { chain: Chains; borrowable: string }) {
  let chainPrefix
  switch (pool.chain) {
    case Chains.BASE:
      chainPrefix = 'basescan.org'
      break
    case Chains.SCROLL:
      chainPrefix = 'scrollscan.com'
      break
    case Chains.OP:
      chainPrefix = 'optimistic.etherscan.io'
      break
    case Chains.FTM:
      chainPrefix = 'ftmscan.com'
      break
    case Chains.BLAST:
      chainPrefix = 'blastscan.io'
      break
    case Chains.SONIC:
      chainPrefix = 'sonicscan.org'
      break
    case Chains.AVAX:
      chainPrefix = 'snowscan.xyz'
      break
    case Chains.WLD:
      chainPrefix = 'worldscan.org'
      break
    default:
      throw new Error(`unknown chain ${pool.chain}`)
  }
  return `https://${chainPrefix}/address/${pool.borrowable}`
}
