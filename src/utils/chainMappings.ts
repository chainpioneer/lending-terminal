import { ASSETS, Chains } from '../constants/constants'

export const chainIdByChain: { [ch in Chains]: string } = {
  [Chains.OP]: '0xa',
  [Chains.BASE]: '0x2105',
  [Chains.SONIC]: '0x92',
  [Chains.AVAX]: '0xa86a',
  [Chains.WLD]: '0x1e0',
}

const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains'

export function chainImgSrc(ch: number | string) {
  switch (ch) {
    case Chains.BASE:
      return `${TW}/base/info/logo.png`
    case Chains.OP:
      return `${TW}/optimism/info/logo.png`
    case Chains.SONIC:
      return 'https://coin-images.coingecko.com/coins/images/38108/small/200x200_Sonic_Logo.png'
    case Chains.AVAX:
      return `${TW}/avalanchec/info/logo.png`
    case Chains.WLD:
      return 'https://assets.coingecko.com/coins/images/31069/standard/worldcoin.jpeg'
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

export function assetImgSrc(asset: number | string) {
  switch (asset) {
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
    case ASSETS.wstETH:
      return `${TW}/ethereum/assets/0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0/logo.png`
    case ASSETS.USDC:
      return `${TW}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`
    case ASSETS.cbBTC:
      return 'https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp'
    case ASSETS.cbETH:
      return `${TW}/ethereum/assets/0xBe9895146f7AF43049ca1c1AE358B0541Ea49704/logo.png`
    case ASSETS.AERO:
      return 'https://assets.coingecko.com/coins/images/31745/standard/token.png'
    case ASSETS.VELO:
      return 'https://assets.coingecko.com/coins/images/25783/standard/velo.png'
    case ASSETS.ETH:
      return `${TW}/ethereum/info/logo.png`
    case ASSETS.OX:
      return 'https://assets.coingecko.com/coins/images/33849/standard/ox_logo.png'
    case ASSETS.COMP:
      return `${TW}/ethereum/assets/0xc00e94Cb662C3520282E6f5717214004A7f26888/logo.png`
    case ASSETS.WBTC:
      return `${TW}/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png`
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

export function platformImgSrc(platform: string) {
  switch (platform) {
    case 'Impermax':
      return 'https://icons.llama.fi/impermax-finance.png'
    case 'Tarot':
      return 'https://www.tarot.to/favicon.ico'
    case 'MORPHO':
      return 'https://cdn.morpho.org/assets/logos/morpho.svg'
    case 'SPARK':
      return 'https://app.spark.fi/spark-logo-dark.svg'
    case 'AAVE':
      return 'https://assets.coingecko.com/coins/images/12645/standard/aave-token-round.png'
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
        case Chains.OP:
          chainId = '10'
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
        case Chains.OP:
          chainPrefix = 'optimism'
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
      return `https://${chainPrefix}.impermax.finance/lending-pool/${
        typeof pool.stable === 'boolean' ? (pool.stable ? '7' : '6') : '4'
      }/${pool.vault.toLowerCase()}`
    }
    case 'AAVE': {
      let chainName
      switch (pool.chain) {
        case Chains.BASE:
          chainName = 'base'
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
    case 'SPARK':
      return 'https://app.spark.fi/savings'
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
    case Chains.OP:
      chainPrefix = 'optimistic.etherscan.io'
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
