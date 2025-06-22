import Web3 from 'web3'

export enum Chains {
  BASE = 'BASE',
  OP = 'OP',
  SCROLL = 'SCROLL',
  FTM = 'FTM',
  BLAST = 'BLAST',
  SONIC = 'SONIC',
}

export enum ASSETS {
  USDC = 'USDC',
  ETH = 'ETH',
  FTM = 'FTM',
  wstETH = 'wstETH',
  cbBTC = 'cbBTC',
  cbETH = 'cbETH',
  AERO = 'AERO',
  OP = 'OP',
  IBEX = 'IBEX',
  OX = 'OX',
  COMP = 'COMP',
  SONIC = 'SONIC',
  VELO = 'VELO',
}

export function getDiv(asset: ASSETS) {
  switch (asset) {
    case ASSETS.USDC:
      return 10 ** 6
    case ASSETS.cbBTC:
      return 10 ** 8
    default:
      return 10 ** 18
  }
}

export const assetConf: { [asset in ASSETS]: { tokenId: string } } = {
  [ASSETS.USDC]: { tokenId: 'usd-coin' },
  [ASSETS.ETH]: { tokenId: 'weth' },
  [ASSETS.FTM]: { tokenId: 'wrapped-fantom' },
  [ASSETS.wstETH]: { tokenId: 'wrapped-steth' },
  [ASSETS.cbBTC]: { tokenId: 'coinbase-wrapped-btc' },
  [ASSETS.cbETH]: { tokenId: 'coinbase-wrapped-staked-eth' },
  [ASSETS.OP]: { tokenId: 'optimism' },
  [ASSETS.IBEX]: { tokenId: 'impermax-2' },
  [ASSETS.OX]: { tokenId: 'ox-fun' },
  [ASSETS.AERO]: { tokenId: 'aerodrome-finance' },
  [ASSETS.COMP]: { tokenId: 'compound-governance-token' },
  [ASSETS.SONIC]: { tokenId: 'sonic-3' },
  [ASSETS.VELO]: { tokenId: 'velodrome-finance' },
}
export const assetByTokenId = Object.assign(
  {},
        ...Object.entries(assetConf).map(([asset, { tokenId: id }]) => ({ [id]: asset })),
)

export const web3Inst = new Web3('')

export const CHAIN_CONF: {
  [key in Chains]: {
    rpcUrls: string[]
    borrowables: string[]
    staking: { [b: string]: { pool: string, rewardToken: string } }
    chainId: number
    assets: { [addr: string]: ASSETS }
    aaveLendingPool: string
    compoundBorrowings: string[]
  }
} = {
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
      web3Inst.utils.toChecksumAddress('0xce34f45b98731e5dae4e0baae37eba63ba07d684'),
      web3Inst.utils.toChecksumAddress('0xe196398b56175247328c2bf4a9c85497fb02914e'),
      web3Inst.utils.toChecksumAddress('0xa4041988b0dcac29bdb2461b01583218374892f1'),
      web3Inst.utils.toChecksumAddress('0x90f5c47cfb7de8e657ebb174d90e3a4d8d64cdd0'),
      web3Inst.utils.toChecksumAddress('0x36e474b287532c92c4509efe44d19bb69fa6b423'),
      web3Inst.utils.toChecksumAddress('0x43ef63ae565fcfbbc277a4c634321c634820ad79'),
      web3Inst.utils.toChecksumAddress('0x4edd336d4d51c1ba8439380d973ab5ba5d179b8c'),
      web3Inst.utils.toChecksumAddress('0xd143c1365e74cfffd7ff747af59a557fffed4f0c'),
      web3Inst.utils.toChecksumAddress('0xdde57a17342bb77c730d09733f20ad4358636d08'),
      web3Inst.utils.toChecksumAddress('0xe865782fe813de288c2b041b49029de7722a999f'),
      web3Inst.utils.toChecksumAddress('0x217fda8dcfe5d892715b01efa11eb8c35a0c0b53'),
      // web3Inst.utils.toChecksumAddress('0x5d93f216f17c225a8B5fFA34e74B7133436281eE'), // V3
    ],
    aaveLendingPool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    compoundBorrowings: [
        '0x784efeB622244d2348d4F2522f8860B96fbEcE89', // AERO
    ],
    staking: {
      // '0x74705C3C2E01891044f8654445DcCf6e28b51758': {
      //   pool: '0x5044792F7880Ce29B4B2cd4CD0c54DF60dfafbDB',
      //   rewardToken: '0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea',
      // },
    },
    rpcUrls: ['https://mainnet.base.org', 'https://1rpc.io/base', 'https://base.meowrpc.com'],
    chainId: 8453,
    assets: {
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
    compoundBorrowings: [],
    rpcUrls: ['https://mainnet.optimism.io', 'https://1rpc.io/op'],
    chainId: 10,
    assets: {
      '0x4200000000000000000000000000000000000006': ASSETS.ETH,
      '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb': ASSETS.wstETH,
      '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': ASSETS.USDC,
      '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': ASSETS.USDC,
      '0x4200000000000000000000000000000000000042': ASSETS.OP,
      '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db': ASSETS.VELO,
    },
  },
  [Chains.SCROLL]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0x261c172cba86b745c46060f856a64bd2dd9d2fd0'),
      // web3Inst.utils.toChecksumAddress('0x56F98d1f75a6345312bf46FDb48aB4728Ff25aDf'), // TKN/USDC toxic
      web3Inst.utils.toChecksumAddress('0x5fcB13b257bFB6A4Fdd4A263CBbfcF487FAd6aa3'),
      web3Inst.utils.toChecksumAddress('0x48305bF15D7002b07f94F52265bdFee36cAA84EA'),
      web3Inst.utils.toChecksumAddress('0x6bb698fcfec8BC3cfF098Fef50e48A3712cb5F2B'),
      web3Inst.utils.toChecksumAddress('0x89B3935F37127294c1C100D159C0849e2f58104A'),
      web3Inst.utils.toChecksumAddress('0x79e7674413855e01690cc7e078d64a71c1cf44c6'),
      web3Inst.utils.toChecksumAddress('0x8509212569bbAcFD254753257Ed6f01010B96D6b'),
      web3Inst.utils.toChecksumAddress('0xf92Fe79d269C3C315973dFcda7D748B1e506991B'),
      // web3Inst.utils.toChecksumAddress('0x382B611B67169Da69D5073746b4EF94cd45Ef620'), // USDC/CHI toxic
      web3Inst.utils.toChecksumAddress('0x38581cD06888569e157ae68d8DF64bD4f48B9eb1'),
      web3Inst.utils.toChecksumAddress('0xD620aDF0B665De2604acC976fD962E4C33dAb398'),
    ],
    staking: {},
    aaveLendingPool: '0x11fCfe756c05AD438e312a7fd934381537D3cFfe',
    compoundBorrowings: [],
    rpcUrls: ['https://rpc.scroll.io', 'https://1rpc.io/scroll', 'https://rpc.ankr.com/scroll', ],
    chainId: 534352,
    assets: {
      '0x5300000000000000000000000000000000000004': ASSETS.ETH,
      '0xf610A9dfB7C89644979b4A0f27063E9e7d7Cda32': ASSETS.wstETH,
      '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4': ASSETS.USDC,
      '0x78Ab77F7D590FB101AA18affc238cbfEA31EAd5b': ASSETS.IBEX,
    },
  },
  [Chains.FTM]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0x9691e8e395b9464f09f486100f5c8ef0136f1fa0'),
      web3Inst.utils.toChecksumAddress('0xb18b1a77b4c36fae9692a5b02bc4b9df4282396c'),
      web3Inst.utils.toChecksumAddress('0xf7d5b28eb3f77a2c0345cbcf73f698837c3223dc'),
      web3Inst.utils.toChecksumAddress('0x9351d443baa89c1597d032557d66a49bfc32c47e'),
      web3Inst.utils.toChecksumAddress('0x948fa788924e8e2a211b22bc0a04c6702c5905f5'),
      web3Inst.utils.toChecksumAddress('0x92ef7a8bbd2911be251452a3147a5505ad8fa08f'),
      web3Inst.utils.toChecksumAddress('0xa5aaa4d6d52e8ab2ef7a6398db552d14b80a6b1f'),
      web3Inst.utils.toChecksumAddress('0x904458d79424d2353e8d93e2cc9dfb4e04629794'),
      web3Inst.utils.toChecksumAddress('0xbe5f69e03c7a38e277ff4b0e270e095bdca47bb6'),
      web3Inst.utils.toChecksumAddress('0x388e0f873ea0d301223d027394f2e8272a38437a'),
      web3Inst.utils.toChecksumAddress('0x7a3c737368d9ab8f00e19fe58cdad7aed586cd49'),
      web3Inst.utils.toChecksumAddress('0xab0de337fe170bb8c8d88664641402b1da410cd7'),
    ],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    rpcUrls: ['https://fantom-json-rpc.stakely.io', 'https://fantom-mainnet.public.blastapi.io', 'https://endpoints.omniatech.io/v1/fantom/mainnet/public', 'https://fantom.drpc.org', 'https://1rpc.io/ftm', 'https://rpc.ftm.tools', 'https://rpc.fantom.network', 'https://rpc.ankr.com/fantom', 'https://rpcapi.fantom.network', 'https://rpc2.fantom.network'],
    chainId: 250,
    assets: {
      '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83': ASSETS.FTM,
    },
  },
  [Chains.BLAST]: {
    borrowables: [
      web3Inst.utils.toChecksumAddress('0xb58c30Ef2681eFEaF7Cb5d6D9840Ab43b36Ba51E'),
      web3Inst.utils.toChecksumAddress('0xcb091A9a8448210D228dAA804982fA67f4828D5C'),
      web3Inst.utils.toChecksumAddress('0x83fAE96f26eeD6974E3EaaEDDAadD82ae50c87a7'),
      web3Inst.utils.toChecksumAddress('0x8651eC5328F3D877B7bB73191EaB75baA2Ca0bab'),
      web3Inst.utils.toChecksumAddress('0x8372eea5de4b4dc7a3964b37c7a2805634f3a172'),
      web3Inst.utils.toChecksumAddress('0x8ac703480fddcc4551236cdb34febafecfe13877'),
    ],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    rpcUrls: ['https://rpc.blast.io', 'https://endpoints.omniatech.io/v1/blast/mainnet/public', 'https://rpc.ankr.com/blast', 'https://blast.din.dev/rpc', 'https://blast-rpc.publicnode.com', 'https://blast.din.dev/rpc'],
    chainId: 81457,
    assets: {
      '0x4300000000000000000000000000000000000004': ASSETS.ETH,
      '0x9f04B6CEfd5BCd67d76aB708F17553Ce40188e6A': ASSETS.IBEX,
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
      web3Inst.utils.toChecksumAddress('0x2de6f52dbb457dffecf1b51602c991afcdc7f780'),
      web3Inst.utils.toChecksumAddress('0x13764f3cc643c99cbbc2961e78968ca70b6e7aa9'),
      // web3Inst.utils.toChecksumAddress('0xcedfb59ef6f24d2c05d639d4672c6644f8e49b8a'), // toxic
      web3Inst.utils.toChecksumAddress('0x5785228ec74209fee27df324d428be92f1244b0e'),
      web3Inst.utils.toChecksumAddress('0xc2285af4f918c9bfd364cd7a5c403fba0f201a43'),
    ],
    staking: {},
    aaveLendingPool: '',
    compoundBorrowings: [],
    rpcUrls: ['https://rpc.soniclabs.com', 'https://sonic.drpc.org', 'https://sonic-rpc.publicnode.com', 'https://rpc.ankr.com/sonic_mainnet', 'https://blast-rpc.publicnode.com'],
    chainId: 146,
    assets: {
      '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38': ASSETS.SONIC,
      '0x29219dd400f2Bf60E5a23d13Be72B486D4038894': ASSETS.USDC,
      '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b': ASSETS.ETH,
    },
  },
}

