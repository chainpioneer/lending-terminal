import Web3 from 'web3'

export enum Chains {
  MAINNET = 'MAINNET',
  BASE = 'BASE',
  OP = 'OP',
  AVAX = 'AVAX',
  SONIC = 'SONIC',
  WLD = 'WLD',
  ARBITRUM = 'ARBITRUM',
  GNOSIS = 'GNOSIS',
}

export enum ASSETS {
  USDC = 'USDC',
  ETH = 'ETH',
  wstETH = 'wstETH',
  cbBTC = 'cbBTC',
  cbETH = 'cbETH',
  AERO = 'AERO',
  OP = 'OP',
  OX = 'OX',
  COMP = 'COMP',
  SONIC = 'SONIC',
  VELO = 'VELO',
  WLD = 'WLD',
  WBTC = 'WBTC',
  AVAX = 'AVAX',
  XDAI = 'XDAI',
  'DAI' = 'DAI',
  'LINK' = 'LINK',
  'AAVE' = 'AAVE',
  'USDT' = 'USDT',
  'rETH' = 'rETH',
  'LUSD' = 'LUSD',
  'CRV' = 'CRV',
  'MKR' = 'MKR',
  'SNX' = 'SNX',
  'BAL' = 'BAL',
  'UNI' = 'UNI',
  'LDO' = 'LDO',
  'ENS' = 'ENS',
  '1INCH' = '1INCH',
  'FRAX' = 'FRAX',
  'GHO' = 'GHO',
  'RPL' = 'RPL',
  'sDAI' = 'sDAI',
  'STG' = 'STG',
  'KNC' = 'KNC',
  'FXS' = 'FXS',
  'crvUSD' = 'crvUSD',
  'PYUSD' = 'PYUSD',
  'weETH' = 'weETH',
  'osETH' = 'osETH',
  'USDe' = 'USDe',
  'ETHx' = 'ETHx',
  'sUSDe' = 'sUSDe',
  'tBTC' = 'tBTC',
  'USDS' = 'USDS',
  'rsETH' = 'rsETH',
  'LBTC' = 'LBTC',
  'eBTC' = 'eBTC',
  'RLUSD' = 'RLUSD',
  'PT-eUSDE-29MAY2025' = 'PT-eUSDE-29MAY2025',
  'PT-sUSDE-31JUL2025' = 'PT-sUSDE-31JUL2025',
  'USDtb' = 'USDtb',
  'PT-USDe-31JUL2025' = 'PT-USDe-31JUL2025',
  'PT-eUSDE-14AUG2025' = 'PT-eUSDE-14AUG2025',
  'eUSDe' = 'eUSDe',
  'FBTC' = 'FBTC',
  'EURC' = 'EURC',
  'PT-sUSDE-25SEP2025' = 'PT-sUSDE-25SEP2025',
  'PT-USDe-25SEP2025' = 'PT-USDe-25SEP2025',
  'tETH' = 'tETH',
  'ezETH' = 'ezETH',
  'XAUt' = 'XAUt',
  'PT-sUSDE-27NOV2025' = 'PT-sUSDE-27NOV2025',
  'PT-USDe-27NOV2025' = 'PT-USDe-27NOV2025',
  'PT-USDe-5FEB2026' = 'PT-USDe-5FEB2026',
  'PT-sUSDE-5FEB2026' = 'PT-sUSDE-5FEB2026',
  'mUSD' = 'mUSD',
  'syrupUSDT' = 'syrupUSDT',
  'USDG' = 'USDG',
  'PT-USDe-7MAY2026' = 'PT-USDe-7MAY2026',
  'PT-sUSDE-7MAY2026' = 'PT-sUSDE-7MAY2026',
  'PT-srUSDe-2APR2026' = 'PT-srUSDe-2APR2026',
  'BTC.b' = 'BTC.b',
  'PT-srUSDe-25JUN2026' = 'PT-srUSDe-25JUN2026',
  'PT-USDG-28MAY2026' = 'PT-USDG-28MAY2026',
  'PT-srUSDe-22OCT2026' = 'PT-srUSDe-22OCT2026',
  'wrsETH' = 'wrsETH',
  'syrupUSDC' = 'syrupUSDC',
  'sUSD' = 'sUSD',
  'MAI' = 'MAI',
}

export function getDiv(asset: ASSETS) {
  if (assetConf[asset].decimals !== undefined) return 10 ** assetConf[asset].decimals!
  switch (asset) {
    case ASSETS.USDC:
      return 10 ** 6
    case ASSETS.cbBTC:
    case ASSETS.WBTC:
      return 10 ** 8
    default:
      return 10 ** 18
  }
}

// New Aave assets use a canonical Aave oracle source, including maturity-specific PTs.
export const assetConf: {
  [asset in ASSETS]: { tokenId?: string; decimals?: number; aave?: { chain: Chains; address: string } }
} = {
  [ASSETS.USDC]: { tokenId: 'usd-coin' },
  [ASSETS.ETH]: { tokenId: 'weth' },
  [ASSETS.wstETH]: { tokenId: 'wrapped-steth' },
  [ASSETS.cbBTC]: { tokenId: 'coinbase-wrapped-btc' },
  [ASSETS.cbETH]: { tokenId: 'coinbase-wrapped-staked-eth' },
  [ASSETS.OP]: { tokenId: 'optimism' },
  [ASSETS.OX]: { tokenId: 'ox-fun' },
  [ASSETS.AERO]: { tokenId: 'aerodrome-finance' },
  [ASSETS.COMP]: { tokenId: 'compound-governance-token' },
  [ASSETS.SONIC]: { tokenId: 'sonic-3' },
  [ASSETS.VELO]: { tokenId: 'velodrome-finance' },
  [ASSETS.WBTC]: { tokenId: 'wrapped-bitcoin' },
  [ASSETS.WLD]: { tokenId: 'worldcoin-wld' },
  [ASSETS.AVAX]: { tokenId: 'avalanche-2' },
  [ASSETS.XDAI]: { tokenId: 'xdai' },
  [ASSETS['DAI']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  },
  [ASSETS['LINK']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
  },
  [ASSETS['AAVE']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
  },
  [ASSETS['USDT']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  },
  [ASSETS['rETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xae78736Cd615f374D3085123A210448E74Fc6393' },
  },
  [ASSETS['LUSD']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0' },
  },
  [ASSETS['CRV']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xD533a949740bb3306d119CC777fa900bA034cd52' },
  },
  [ASSETS['MKR']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' },
  },
  [ASSETS['SNX']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F' },
  },
  [ASSETS['BAL']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xba100000625a3754423978a60c9317c58a424e3D' },
  },
  [ASSETS['UNI']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
  },
  [ASSETS['LDO']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' },
  },
  [ASSETS['ENS']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72' },
  },
  [ASSETS['1INCH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x111111111117dC0aa78b770fA6A738034120C302' },
  },
  [ASSETS['FRAX']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x853d955aCEf822Db058eb8505911ED77F175b99e' },
  },
  [ASSETS['GHO']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f' },
  },
  [ASSETS['RPL']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xD33526068D116cE69F19A9ee46F0bd304F21A51f' },
  },
  [ASSETS['sDAI']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x83F20F44975D03b1b09e64809B757c47f942BEeA' },
  },
  [ASSETS['STG']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6' },
  },
  [ASSETS['KNC']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xdeFA4e8a7bcBA345F687a2f1456F5Edd9CE97202' },
  },
  [ASSETS['FXS']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0' },
  },
  [ASSETS['crvUSD']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E' },
  },
  [ASSETS['PYUSD']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8' },
  },
  [ASSETS['weETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee' },
  },
  [ASSETS['osETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38' },
  },
  [ASSETS['USDe']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3' },
  },
  [ASSETS['ETHx']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xA35b1B31Ce002FBF2058D22F30f95D405200A15b' },
  },
  [ASSETS['sUSDe']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497' },
  },
  [ASSETS['tBTC']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x18084fbA666a33d37592fA2633fD49a74DD93a88' },
  },
  [ASSETS['USDS']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F' },
  },
  [ASSETS['rsETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7' },
  },
  [ASSETS['LBTC']]: {
    decimals: 8,
    aave: { chain: Chains.MAINNET, address: '0x8236a87084f8B84306f72007F36F2618A5634494' },
  },
  [ASSETS['eBTC']]: {
    decimals: 8,
    aave: { chain: Chains.MAINNET, address: '0x657e8C867D8B37dCC18fA4Caead9C45EB088C642' },
  },
  [ASSETS['RLUSD']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD' },
  },
  [ASSETS['PT-eUSDE-29MAY2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x50D2C7992b802Eef16c04FeADAB310f31866a545' },
  },
  [ASSETS['PT-sUSDE-31JUL2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x3b3fB9C57858EF816833dC91565EFcd85D96f634' },
  },
  [ASSETS['USDtb']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xC139190F447e929f090Edeb554D95AbB8b18aC1C' },
  },
  [ASSETS['PT-USDe-31JUL2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x917459337CaAC939D41d7493B3999f571D20D667' },
  },
  [ASSETS['PT-eUSDE-14AUG2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x14Bdc3A3AE09f5518b923b69489CBcAfB238e617' },
  },
  [ASSETS['eUSDe']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x90D2af7d622ca3141efA4d8f1F24d86E5974Cc8F' },
  },
  [ASSETS['FBTC']]: {
    decimals: 8,
    aave: { chain: Chains.MAINNET, address: '0xC96dE26018A54D51c097160568752c4E3BD6C364' },
  },
  [ASSETS['EURC']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c' },
  },
  [ASSETS['PT-sUSDE-25SEP2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x9F56094C450763769BA0EA9Fe2876070c0fD5F77' },
  },
  [ASSETS['PT-USDe-25SEP2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xBC6736d346a5eBC0dEbc997397912CD9b8FAe10a' },
  },
  [ASSETS['tETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xD11c452fc99cF405034ee446803b6F6c1F6d5ED8' },
  },
  [ASSETS['ezETH']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110' },
  },
  [ASSETS['XAUt']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0x68749665FF8D2d112Fa859AA293F07A622782F38' },
  },
  [ASSETS['PT-sUSDE-27NOV2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xe6A934089BBEe34F832060CE98848359883749B3' },
  },
  [ASSETS['PT-USDe-27NOV2025']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x62C6E813b9589C3631Ba0Cdb013acdB8544038B7' },
  },
  [ASSETS['PT-USDe-5FEB2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x1F84a51296691320478c98b8d77f2Bbd17D34350' },
  },
  [ASSETS['PT-sUSDE-5FEB2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xE8483517077afa11A9B07f849cee2552f040d7b2' },
  },
  [ASSETS['mUSD']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0xacA92E438df0B2401fF60dA7E4337B687a2435DA' },
  },
  [ASSETS['syrupUSDT']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0x356B8d89c1e1239Cbbb9dE4815c39A1474d5BA7D' },
  },
  [ASSETS['USDG']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D' },
  },
  [ASSETS['PT-USDe-7MAY2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0xAeBf0Bb9f57E89260d57f31AF34eB58657d96Ce0' },
  },
  [ASSETS['PT-sUSDE-7MAY2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x3de0ff76E8b528C092d47b9DaC775931cef80F49' },
  },
  [ASSETS['PT-srUSDe-2APR2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x9Bf45ab47747F4B4dD09B3C2c73953484b4eB375' },
  },
  [ASSETS['BTC.b']]: {
    decimals: 8,
    aave: { chain: Chains.MAINNET, address: '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072' },
  },
  [ASSETS['PT-srUSDe-25JUN2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x619D75E3b790eBC21c289f2805Bb7177A7D732E2' },
  },
  [ASSETS['PT-USDG-28MAY2026']]: {
    decimals: 6,
    aave: { chain: Chains.MAINNET, address: '0x9db38D74a0D29380899aD354121DfB521aDb0548' },
  },
  [ASSETS['PT-srUSDe-22OCT2026']]: {
    decimals: 18,
    aave: { chain: Chains.MAINNET, address: '0x59bC9FaE5D62B19d4f8d07D758047aCb9EE19d34' },
  },
  [ASSETS['wrsETH']]: {
    decimals: 18,
    aave: { chain: Chains.BASE, address: '0xEDfa23602D0EC14714057867A78d01e94176BEA0' },
  },
  [ASSETS['syrupUSDC']]: {
    decimals: 6,
    aave: { chain: Chains.BASE, address: '0x660975730059246A68521a3e2FBD4740173100f5' },
  },
  [ASSETS['sUSD']]: { decimals: 18, aave: { chain: Chains.OP, address: '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9' } },
  [ASSETS['MAI']]: { decimals: 18, aave: { chain: Chains.OP, address: '0xdFA46478F9e5EA86d57387849598dbFB2e964b02' } },
}
export const POOL_FILTER_APR_THRESHOLD = 2
export const POOL_FILTER_CAPACITY_THRESHOLD = -1
export const POOL_FILTER_MIN_TVL = 1_000
export const SONIC_PAST_BLOCK_OFFSET = 1_000
export const ARBITRUM_PAST_BLOCK_OFFSET = 4_000
export const GNOSIS_PAST_BLOCK_OFFSET = 10_000
export const DEFAULT_PAST_BLOCK_OFFSET = 100

export const assetByTokenId = Object.assign(
  {},
  ...Object.entries(assetConf).flatMap(([asset, { tokenId: id }]) => (id ? [{ [id]: asset }] : [])),
)

export const web3Inst = new Web3('')

export const CHAIN_CONF: {
  [key in Chains]: {
    rpcUrls: string[]
    borrowables: string[]
    staking: { [b: string]: { pool: string; rewardToken: string } }
    chainId: number
    assets: { [addr: string]: ASSETS }
    aaveLendingPool: string
    aaveOracle?: string
    merklCampaignsUrl?: string
    compoundBorrowings: string[]
    morpho?: {
      MORPHO: string
      borrowings: string[]
      pools: string[]
      merklCampaignsUrl: string
    }
    spark?: {
      pools: string[]
      rewardsCampaignsUrl: string
      // pool => adapter with vaultAPY(), for vaults whose yield arrives in lumps (Gnosis sDAI)
      vaultAPYAdapters?: { [pool: string]: string }
    }
    revert?: {
      vaults: string[]
    }
    extra?: {
      lendingPool: string
      reserveIds: number[]
    }
  }
} = {
  [Chains.MAINNET]: {
    borrowables: [],
    staking: {},
    aaveLendingPool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    aaveOracle: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',
    compoundBorrowings: [],
    revert: {
      vaults: ['0xa2754543f69dC036764bBfad16d2A74F5cD15667'],
    },
    rpcUrls: [
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://ethereum-rpc.publicnode.com',
      'https://mainnet.gateway.tenderly.co',
    ],
    chainId: 1,
    assets: {
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': ASSETS['DAI'],
      '0x514910771AF9Ca656af840dff83E8264EcF986CA': ASSETS['LINK'],
      '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9': ASSETS['AAVE'],
      '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704': ASSETS['cbETH'],
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': ASSETS['USDT'],
      '0xae78736Cd615f374D3085123A210448E74Fc6393': ASSETS['rETH'],
      '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0': ASSETS['LUSD'],
      '0xD533a949740bb3306d119CC777fa900bA034cd52': ASSETS['CRV'],
      '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2': ASSETS['MKR'],
      '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F': ASSETS['SNX'],
      '0xba100000625a3754423978a60c9317c58a424e3D': ASSETS['BAL'],
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': ASSETS['UNI'],
      '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32': ASSETS['LDO'],
      '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72': ASSETS['ENS'],
      '0x111111111117dC0aa78b770fA6A738034120C302': ASSETS['1INCH'],
      '0x853d955aCEf822Db058eb8505911ED77F175b99e': ASSETS['FRAX'],
      '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f': ASSETS['GHO'],
      '0xD33526068D116cE69F19A9ee46F0bd304F21A51f': ASSETS['RPL'],
      '0x83F20F44975D03b1b09e64809B757c47f942BEeA': ASSETS['sDAI'],
      '0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6': ASSETS['STG'],
      '0xdeFA4e8a7bcBA345F687a2f1456F5Edd9CE97202': ASSETS['KNC'],
      '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0': ASSETS['FXS'],
      '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E': ASSETS['crvUSD'],
      '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8': ASSETS['PYUSD'],
      '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee': ASSETS['weETH'],
      '0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38': ASSETS['osETH'],
      '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3': ASSETS['USDe'],
      '0xA35b1B31Ce002FBF2058D22F30f95D405200A15b': ASSETS['ETHx'],
      '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497': ASSETS['sUSDe'],
      '0x18084fbA666a33d37592fA2633fD49a74DD93a88': ASSETS['tBTC'],
      '0xdC035D45d973E3EC169d2276DDab16f1e407384F': ASSETS['USDS'],
      '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7': ASSETS['rsETH'],
      '0x8236a87084f8B84306f72007F36F2618A5634494': ASSETS['LBTC'],
      '0x657e8C867D8B37dCC18fA4Caead9C45EB088C642': ASSETS['eBTC'],
      '0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD': ASSETS['RLUSD'],
      '0x50D2C7992b802Eef16c04FeADAB310f31866a545': ASSETS['PT-eUSDE-29MAY2025'],
      '0x3b3fB9C57858EF816833dC91565EFcd85D96f634': ASSETS['PT-sUSDE-31JUL2025'],
      '0xC139190F447e929f090Edeb554D95AbB8b18aC1C': ASSETS['USDtb'],
      '0x917459337CaAC939D41d7493B3999f571D20D667': ASSETS['PT-USDe-31JUL2025'],
      '0x14Bdc3A3AE09f5518b923b69489CBcAfB238e617': ASSETS['PT-eUSDE-14AUG2025'],
      '0x90D2af7d622ca3141efA4d8f1F24d86E5974Cc8F': ASSETS['eUSDe'],
      '0xC96dE26018A54D51c097160568752c4E3BD6C364': ASSETS['FBTC'],
      '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c': ASSETS['EURC'],
      '0x9F56094C450763769BA0EA9Fe2876070c0fD5F77': ASSETS['PT-sUSDE-25SEP2025'],
      '0xBC6736d346a5eBC0dEbc997397912CD9b8FAe10a': ASSETS['PT-USDe-25SEP2025'],
      '0xD11c452fc99cF405034ee446803b6F6c1F6d5ED8': ASSETS['tETH'],
      '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110': ASSETS['ezETH'],
      '0x68749665FF8D2d112Fa859AA293F07A622782F38': ASSETS['XAUt'],
      '0xe6A934089BBEe34F832060CE98848359883749B3': ASSETS['PT-sUSDE-27NOV2025'],
      '0x62C6E813b9589C3631Ba0Cdb013acdB8544038B7': ASSETS['PT-USDe-27NOV2025'],
      '0x1F84a51296691320478c98b8d77f2Bbd17D34350': ASSETS['PT-USDe-5FEB2026'],
      '0xE8483517077afa11A9B07f849cee2552f040d7b2': ASSETS['PT-sUSDE-5FEB2026'],
      '0xacA92E438df0B2401fF60dA7E4337B687a2435DA': ASSETS['mUSD'],
      '0x356B8d89c1e1239Cbbb9dE4815c39A1474d5BA7D': ASSETS['syrupUSDT'],
      '0xe343167631d89B6Ffc58B88d6b7fB0228795491D': ASSETS['USDG'],
      '0xAeBf0Bb9f57E89260d57f31AF34eB58657d96Ce0': ASSETS['PT-USDe-7MAY2026'],
      '0x3de0ff76E8b528C092d47b9DaC775931cef80F49': ASSETS['PT-sUSDE-7MAY2026'],
      '0x9Bf45ab47747F4B4dD09B3C2c73953484b4eB375': ASSETS['PT-srUSDe-2APR2026'],
      '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072': ASSETS['BTC.b'],
      '0x619D75E3b790eBC21c289f2805Bb7177A7D732E2': ASSETS['PT-srUSDe-25JUN2026'],
      '0x9db38D74a0D29380899aD354121DfB521aDb0548': ASSETS['PT-USDG-28MAY2026'],
      '0x59bC9FaE5D62B19d4f8d07D758047aCb9EE19d34': ASSETS['PT-srUSDe-22OCT2026'],
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': ASSETS.ETH,
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': ASSETS.USDC,
      '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0': ASSETS.wstETH,
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': ASSETS.WBTC,
      '0xc00e94Cb662C3520282E6f5717214004A7f26888': ASSETS.COMP,
      '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf': ASSETS.cbBTC,
    },
  },
  [Chains.BASE]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0x271dbacca7b447db75d4751ecb7fc3dab4910916'),
      web3Inst.utils.toChecksumAddress('0x60a86B077843F9E6cda580782EA3CCB8E2B8794c'),
      web3Inst.utils.toChecksumAddress('0xd3c4eda1f275bb95d960621a747ab6bbacb6694a'),
      web3Inst.utils.toChecksumAddress('0x8fb8e02fce8eb1ade5213564140090df7b5ab1b5'),
      web3Inst.utils.toChecksumAddress('0xb72b27daf51d83b238c43f7d7ce6b461a774249b'),
      web3Inst.utils.toChecksumAddress('0x4ddA3Ae5576B7D5B42626D671d1Ae738716bc459'),
      web3Inst.utils.toChecksumAddress('0x04db41d3afbaa587bef2baa23ee383631196f243'),
      web3Inst.utils.toChecksumAddress('0xbebc60ca78147c04ede280f7f46777e8cf139924'),
      web3Inst.utils.toChecksumAddress('0xe43872854ce04be138a81a383901c8d6f55c5b20'),
      web3Inst.utils.toChecksumAddress('0x897cf921b95e493fca1fe007573b89a98974c45b'),
      web3Inst.utils.toChecksumAddress('0x6b3e5a7e2774c5158d619aa28845d64d90a3926c'),
      web3Inst.utils.toChecksumAddress('0xa9B5d4bF5E8cBC168B55f92688ECA66E098fB5Fa'),
      web3Inst.utils.toChecksumAddress('0x2edd0e2249179336b09b8bb69118d29326ec5409'),
      web3Inst.utils.toChecksumAddress('0x0c8c948ED09B92A9fC489CeCe85Cc7E1E22D964F'),
      web3Inst.utils.toChecksumAddress('0xe70B375f76f32c489fb72D630e73Ebc738CEE73a'),
      // web3Inst.utils.toChecksumAddress('0x74705C3C2E01891044f8654445DcCf6e28b51758'), // OX toxic
      // web3Inst.utils.toChecksumAddress('0x3c3Bd349bBB59D588FAC1CE00CA64878Ee54eA5e'), //toxic
      web3Inst.utils.toChecksumAddress('0x9f1c0Bad87dcDBC85C7F8C036DF646001AFC31B8'),
      web3Inst.utils.toChecksumAddress('0x1d63c27367dd5a8c86b59934645df46d5486240f'),
      web3Inst.utils.toChecksumAddress('0x51f51ccf2f17afec75f79d2a4fb0ac289dcc385b'),
      web3Inst.utils.toChecksumAddress('0x08383d1f85e1c5f6f1b08f005fb48c93a41ca2c7'),
      web3Inst.utils.toChecksumAddress('0x4d12d8a31cabb91d5354c657531ab967b5bea835'),
      web3Inst.utils.toChecksumAddress('0xdDE57a17342Bb77c730d09733F20Ad4358636d08'),
      web3Inst.utils.toChecksumAddress('0x31C7df9a030ea659140a005f7c88a07860136B87'),
      web3Inst.utils.toChecksumAddress('0x3f0228ee6DbFf549dF9e5116757Ff193449600B9'),
      web3Inst.utils.toChecksumAddress('0x9d36f71afc4ceD306DBF4c3bdC372E4E363B963a'),
      web3Inst.utils.toChecksumAddress('0x3f2a6aD746912fBA9808e7DF0286d60CE5c358be'),
      web3Inst.utils.toChecksumAddress('0x219FEf85444Ba96e1412E9e0d2b050a58456c68a'),
      web3Inst.utils.toChecksumAddress('0xec089d749f70624d57aa753db20b8eb5d3231068'),
      web3Inst.utils.toChecksumAddress('0x594d04cc12d20a8b48578bd3b9c69b371460bed5'),
      web3Inst.utils.toChecksumAddress('0x1cc240ed506bb7ee062b4916873e934ea1dd2194'),
      web3Inst.utils.toChecksumAddress('0xf2b5ebdd02861392c4aa90838ef4d549362754a4'),
      // web3Inst.utils.toChecksumAddress('0xce34f45b98731e5dae4e0baae37eba63ba07d684'), // toxic
      web3Inst.utils.toChecksumAddress('0xe196398b56175247328c2bf4a9c85497fb02914e'),
      web3Inst.utils.toChecksumAddress('0xa4041988b0dcac29bdb2461b01583218374892f1'),
      web3Inst.utils.toChecksumAddress('0x90f5c47cfb7de8e657ebb174d90e3a4d8d64cdd0'),
      // web3Inst.utils.toChecksumAddress('0x36e474b287532c92c4509efe44d19bb69fa6b423'), // toxic
      web3Inst.utils.toChecksumAddress('0x43ef63ae565fcfbbc277a4c634321c634820ad79'),
      web3Inst.utils.toChecksumAddress('0x4edd336d4d51c1ba8439380d973ab5ba5d179b8c'),
      web3Inst.utils.toChecksumAddress('0xd143c1365e74cfffd7ff747af59a557fffed4f0c'),
      web3Inst.utils.toChecksumAddress('0xdde57a17342bb77c730d09733f20ad4358636d08'),
      web3Inst.utils.toChecksumAddress('0xe865782fe813de288c2b041b49029de7722a999f'),
      web3Inst.utils.toChecksumAddress('0x217fda8dcfe5d892715b01efa11eb8c35a0c0b53'),
      // web3Inst.utils.toChecksumAddress('0x5d93f216f17c225a8B5fFA34e74B7133436281eE'), // V3
    ],
    aaveLendingPool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    aaveOracle: '0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156',
    compoundBorrowings: [
      '0x784efeB622244d2348d4F2522f8860B96fbEcE89', // AERO
    ],
    revert: {
      vaults: ['0x36AEAe0E411a1E28372e0d66f02E57744EbE7599'],
    },
    extra: {
      lendingPool: '0xBB505c54D71E9e599cB8435b4F0cEEc05fC71cbD',
      reserveIds: [25], // USDC
    },
    staking: {
      // '0x74705C3C2E01891044f8654445DcCf6e28b51758': {
      //   pool: '0x5044792F7880Ce29B4B2cd4CD0c54DF60dfafbDB',
      //   rewardToken: '0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea',
      // },
    },
    rpcUrls: ['https://mainnet.base.org', 'https://1rpc.io/base', 'https://base.meowrpc.com'],
    chainId: 8453,
    assets: {
      '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A': ASSETS['weETH'],
      '0x2416092f143378750bb29b79eD961ab195CcEea5': ASSETS['ezETH'],
      '0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee': ASSETS['GHO'],
      '0xEDfa23602D0EC14714057867A78d01e94176BEA0': ASSETS['wrsETH'],
      '0xecAc9C5F704e954931349Da37F60E39f515c11c1': ASSETS['LBTC'],
      '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42': ASSETS['EURC'],
      '0x63706e401c06ac8513145b7687A14804d17f814b': ASSETS['AAVE'],
      '0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b': ASSETS['tBTC'],
      '0x660975730059246A68521a3e2FBD4740173100f5': ASSETS['syrupUSDC'],
      '0x4200000000000000000000000000000000000006': ASSETS.ETH,
      '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452': ASSETS.wstETH,
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': ASSETS.USDC,
      '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA': ASSETS.USDC,
      '0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea': ASSETS.OX,
      '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf': ASSETS.cbBTC,
      '0x940181a94A35A4569E4529A3CDfB74e38FD98631': ASSETS.AERO,
      '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22': ASSETS.cbETH,
    },
  },
  [Chains.OP]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0x0fac6BBfc6d56E1B7ABEB58fD437017603Ed731f'),
      web3Inst.utils.toChecksumAddress('0xf57fcaacb6ac3f9b5a630c315e7fbd638914375c'),
      web3Inst.utils.toChecksumAddress('0x583460f3b6ed8b20ed153b4fd20fd12efa7e3ee1'),
      web3Inst.utils.toChecksumAddress('0x2a503f2c408ee24e13b33a08446478d5cef70d3c'),
      web3Inst.utils.toChecksumAddress('0x6E370804181b2B5f9090C152CC87f687c0f635F3'),
      web3Inst.utils.toChecksumAddress('0x65d62988a06bda35f9b16c0f5a5541c100989dbb'),
      web3Inst.utils.toChecksumAddress('0xfacdd4a72b110be8f193ebdb0ba66196955d919e'),
      web3Inst.utils.toChecksumAddress('0x388a16D05b5eB4BB4c6D6f841544c6138219dF53'),
      web3Inst.utils.toChecksumAddress('0x261a84Bb62A1d10006711746dd8a5cB7eDc3F41d'),
      web3Inst.utils.toChecksumAddress('0xdeaec1c1766de8bc6f0d04a464c5d914d6a2b96c'),
      web3Inst.utils.toChecksumAddress('0x68ef7f9b5debce90f654dc988e17c504782ec76d'),
      web3Inst.utils.toChecksumAddress('0xb9d9de899425555355fdb0d3c70901e74b090115'),
    ],
    staking: {},
    aaveLendingPool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    aaveOracle: '0xD81eb3728a631871a7eBBaD631b5f424909f0c77',
    compoundBorrowings: [],
    rpcUrls: [
      'https://gateway.tenderly.co/public/optimism',
      'https://0xrpc.io/op',
      'https://optimism.drpc.org',
      'https://op-pokt.nodies.app',
    ],
    chainId: 10,
    assets: {
      '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1': ASSETS['DAI'],
      '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6': ASSETS['LINK'],
      '0x68f180fcCe6836688e9084f035309E29Bf0A2095': ASSETS['WBTC'],
      '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58': ASSETS['USDT'],
      '0x76FB31fb4af56892A25e32cFC43De717950c9278': ASSETS['AAVE'],
      '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9': ASSETS['sUSD'],
      '0xc40F949F8a4e094D1b49a23ea9241D289B7b2819': ASSETS['LUSD'],
      '0xdFA46478F9e5EA86d57387849598dbFB2e964b02': ASSETS['MAI'],
      '0x9Bcef72be871e61ED4fBbc7630889beE758eb81D': ASSETS['rETH'],
      '0x4200000000000000000000000000000000000006': ASSETS.ETH,
      '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb': ASSETS.wstETH,
      '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': ASSETS.USDC,
      '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': ASSETS.USDC,
      '0x4200000000000000000000000000000000000042': ASSETS.OP,
      '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db': ASSETS.VELO,
    },
  },
  [Chains.AVAX]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0xcaafc9fa9b269682daa4c23791c0956bfeea6cd1'),
      web3Inst.utils.toChecksumAddress('0x715944d28cf27ba19ae1a6302360b71ef202a9aa'),
      web3Inst.utils.toChecksumAddress('0x2508827cb683e92d0e569627efc68454a7dcc4a8'),
      web3Inst.utils.toChecksumAddress('0x383646da9c7f625e96b7fb8d495d63410691e57d'),
      web3Inst.utils.toChecksumAddress('0x5323c30556b7aebfbc8bab5f640b577828f364a7'),
      web3Inst.utils.toChecksumAddress('0xe82b222133a8fe503ef81a921c8e62196ae5f9c4'),
      web3Inst.utils.toChecksumAddress('0x1a88287caddd80b2406d075258e5ff0b7e5bb75e'),
      web3Inst.utils.toChecksumAddress('0x723be15dc4409cbe5bb5ef33d5d0c5eb9e4c5ba2'),
      web3Inst.utils.toChecksumAddress('0x3763fef23e664d708dd87779dc59e57140dcc43d'),
      web3Inst.utils.toChecksumAddress('0xa259e393d8fedf5ad38842d19f3b274695b5653a'),
    ],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    spark: {
      pools: ['0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d'],
      rewardsCampaignsUrl: 'https://spark-api-proxy.chainpioneer.workers.dev/api/v1/rewards/campaigns/',
    },
    rpcUrls: [
      'https://avalanche-mainnet.gateway.tenderly.co',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://api.avax.network/ext/bc/C/rpc',
      'https://1rpc.io/avax/c',
      'https://avalanche.drpc.org',
      'https://0xrpc.io/avax',
    ],
    chainId: 43114,
    assets: {
      '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': ASSETS.AVAX,
      '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': ASSETS.USDC,
      '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB': ASSETS.ETH,
    },
  },
  [Chains.SONIC]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0xd12d3F128290F38eb574D58Af26B8bB1705464a8'),
      web3Inst.utils.toChecksumAddress('0x484d5f48e8d97126422e77353b21d4c5b773f443'),
      web3Inst.utils.toChecksumAddress('0x8d05ba24F6aE7a0Ba99fa029be79Aefa2CA94458'),
      web3Inst.utils.toChecksumAddress('0xc40c6b4b8645412C81C1627d1e24b5b6705C5c20'),
      web3Inst.utils.toChecksumAddress('0x08efcd7c1b5ef4dcdf0bf7821fbfb6388c115698'),
      web3Inst.utils.toChecksumAddress('0x75414f3cb1881eb477cc811ff17d04fec5adebdc'),
      web3Inst.utils.toChecksumAddress('0x8607400d97b782493629b7dea99b79f90a5347f3'),
      web3Inst.utils.toChecksumAddress('0x7Eac328292b106b747B86755A453bD801FAaC620'),
      web3Inst.utils.toChecksumAddress('0x6D053bD7266eF5e047bdd0F557AAb75e255EBe9D'),
      web3Inst.utils.toChecksumAddress('0x6b6E9E5e8E3d35383dea994D9f01cD9680F7bc4E'),
      web3Inst.utils.toChecksumAddress('0xfc28227028e06a71283ecd4f8d2d8955e09778ef'),
      // web3Inst.utils.toChecksumAddress('0x2de6f52dbb457dffecf1b51602c991afcdc7f780'), // toxic
      web3Inst.utils.toChecksumAddress('0x13764f3cc643c99cbbc2961e78968ca70b6e7aa9'),
      // web3Inst.utils.toChecksumAddress('0xcedfb59ef6f24d2c05d639d4672c6644f8e49b8a'), // toxic
      // web3Inst.utils.toChecksumAddress('0x5785228ec74209fee27df324d428be92f1244b0e'), // toxic
      // web3Inst.utils.toChecksumAddress('0xc2285af4f918c9bfd364cd7a5c403fba0f201a43'), // toxic
      web3Inst.utils.toChecksumAddress('0x98d4358d95163daf6000ce035dceaf785416ffa4'),
    ],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    rpcUrls: [
      'https://sonic.drpc.org',
      'https://sonic-rpc.publicnode.com',
      'https://rpc.ankr.com/sonic_mainnet',
      'https://blast-rpc.publicnode.com',
      'https://rpc.soniclabs.com',
    ],
    chainId: 146,
    assets: {
      '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38': ASSETS.SONIC,
      '0x29219dd400f2Bf60E5a23d13Be72B486D4038894': ASSETS.USDC,
      '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b': ASSETS.ETH,
    },
  },
  [Chains.WLD]: {
    borrowables: [],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    morpho: {
      MORPHO: '0xE741BC7c34758b4caE05062794E8Ae24978AF432',
      pools: ['0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B', '0x0Db7E405278c2674F462aC9D9eb8b8346D1c1571'],
      borrowings: [
        // '0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B'
      ],
      merklCampaignsUrl:
        'https://api.merkl.xyz/v4/opportunities/campaigns?chainId=480&status=LIVE&types=MORPHOVAULT,MORPHOBORROW',
    },
    rpcUrls: [
      'https://worldchain-mainnet.gateway.tenderly.co',
      'https://worldchain-mainnet.g.alchemy.com/public',
      'https://worldchain.drpc.org',
      'https://480.rpc.thirdweb.com',
      'https://sparkling-autumn-dinghy.worldchain-mainnet.quiknode.pro',
    ],
    chainId: 480,
    assets: {
      '0x03C7054BCB39f7b2e5B2c7AcB37583e32D70Cfa3': ASSETS.WBTC,
      '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1': ASSETS.USDC,
      '0x2cFc85d8E48F8EAB294be644d9E25C3030863003': ASSETS.WLD,
      '0x4200000000000000000000000000000000000006': ASSETS.ETH,
    },
  },
  [Chains.ARBITRUM]: {
    borrowables: [],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    revert: {
      vaults: ['0x74e6afef5705beb126c6d3bf46f8fad8f3e07825'],
    },
    rpcUrls: [
      'https://arbitrum.gateway.tenderly.co',
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one.public.blastapi.io',
      'https://arbitrum.drpc.org',
      'https://0xrpc.io/arb',
      'https://1rpc.io/arb',
      'https://arbitrum-one-rpc.publicnode.com',
    ],
    chainId: 42161,
    assets: {
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': ASSETS.USDC,
      '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': ASSETS.USDC,
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': ASSETS.ETH,
    },
  },
  [Chains.GNOSIS]: {
    borrowables: [],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    spark: {
      pools: ['0xaf204776c7245bF4147c2612BF6e5972Ee483701'],
      rewardsCampaignsUrl: '',
      vaultAPYAdapters: {
        '0xaf204776c7245bF4147c2612BF6e5972Ee483701': '0xD499b51fcFc66bd31248ef4b28d656d67E591A94',
      },
    },
    rpcUrls: [
      'https://gnosis.drpc.org',
      'https://rpc.gnosischain.com',
      'https://gnosis-rpc.publicnode.com',
      'https://rpc.ankr.com/gnosis',
    ],
    chainId: 100,
    assets: {
      '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d': ASSETS.XDAI,
    },
  },
}
