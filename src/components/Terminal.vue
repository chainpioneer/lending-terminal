<script setup lang="ts">
import {ref} from 'vue'
import load, {Pool} from "../logic/load";
import {isAddress} from "web3-validator";
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Image from 'primevue/image';
import ProgressSpinner from 'primevue/progressspinner';
import Popover from 'primevue/popover';
import Panel from 'primevue/panel';
import {ASSETS, Chains} from "../constants/constants";
import ToggleSwitch from 'primevue/toggleswitch';
import {Deposit} from "../utils/depositUtils";

defineProps<{ msg: string }>()

const fetchingData = ref(false)
const subscribed = ref(false)
const addresses = ref(localStorage.getItem('userStr') || '')
const data: any = ref<Awaited<ReturnType<typeof load>>>()
const wallet = ref('')
const chain = ref('')
const collapsed = ref({
  'globals': localStorage.getItem('collapsed.globals') !== 'false',
  'chains': localStorage.getItem('collapsed.chains') !== 'false',
  'assets': localStorage.getItem('collapsed.assets') !== 'false',
  'lending': localStorage.getItem('collapsed.lending') !== 'false'
})

const idleByUser = ref<any>();
const idleByAssetByUser = ref();
const idleByChainByUser = ref();
const idleByChainByAssetByUser = ref({});

const suppliedByUser = ref();
const suppliedByAssetByUser = ref();
const suppliedByChainByUser = ref();
const suppliedByChainByAssetByUser = ref({});
const suppliedByChainByBorrowableByUser = ref<{ [chain: string]: { [borrowable: string]: { [user: string]: Deposit } } }>({});

const selectedChains = ref<{ [chain: string]: boolean }>({});
const selectedAssets = ref<{ [asset: string]: boolean }>({});

const onlyMyDeposits = ref(false);

const showIdleByUser = (event: any) => {
  idleByUser.value.toggle(event);
}

const showIdleByAssetByUser = (index: number, event: any) => {
  (idleByAssetByUser as any).value[index].toggle(event);
}

const setCollapsed = (id: string, state: boolean) => {
  (collapsed as any).value[id] = state;
  localStorage.setItem(`collapsed.${id}`, String(state))
}

const showIdleByChainByUser = (index: number, event: any) => {
  (idleByChainByUser as any).value[index].toggle(event);
}

const showIdleByChainByAssetByUser = (chain: number, asset: number, event: any) => {
  (idleByChainByAssetByUser as any).value[chain + asset].toggle(event);
}

const showDepositByUser = (event: any) => {
  (suppliedByUser as any).value.toggle(event);
}

const showDepositByAssetByUser = (index: number, event: any) => {
  (suppliedByAssetByUser as any).value[index].toggle(event);
}

const showDepositByChainByUser = (index: number, event: any) => {
  (suppliedByChainByUser as any).value[index].toggle(event);
}

const showDepositByChainByAssetByUser = (chain: number, asset: number, event: any) => {
  (suppliedByChainByAssetByUser as any).value[chain + asset].toggle(event);
}

const showDepositByChainByAssetByBorrowableByUser = (chain: string, borrowable: string, event: any) => {
  (suppliedByChainByBorrowableByUser as any).value[chain + borrowable].toggle(event);
}

const toggleChainSelected = (chain: string) => {
  let allSelected = true
  let selectedCount = 0
  let selectedChain
  Object.entries(selectedChains.value).forEach(([ch, flag]) => {
    if (flag) {
      selectedChain = ch
      selectedCount ++
    } else {
      allSelected = false
    }
    return !allSelected && selectedCount > 1
  })
  if (allSelected) {
    data.value.poolChains.forEach((ch: string) => {
      if (chain === ch) return
      selectedChains.value[ch] = false
    })
  } else if (selectedCount === 1 && chain === selectedChain) {
    data.value.poolChains.forEach((ch: string) => {
      selectedChains.value[ch] = true
    })
  } else {
    selectedChains.value[chain] = !selectedChains.value[chain]
  }
}

const toggleAssetSelected = (asset: string) => {
  let allSelected = true
  let selectedCount = 0
  let selectedAsset
  Object.entries(selectedAssets.value).forEach(([a, flag]) => {
    if (flag) {
      selectedAsset = a
      selectedCount ++
    } else {
      allSelected = false
    }
    return !allSelected && selectedCount > 1
  })

  if (allSelected) {
    data.value.poolAssets.forEach((a: string) => {
      if (asset === a) return
      selectedAssets.value[a] = false
    })
  } else if (selectedCount === 1 && asset === selectedAsset) {
    data.value.poolAssets.forEach((a: string) => {
      selectedAssets.value[a] = true
    })
  } else {
    selectedAssets.value[asset] = !selectedAssets.value[asset]
  }
}

const storage = () => localStorage

const chainIdByChain: { [ch in Chains]: string } = {
  [Chains.SCROLL]: '0x82750',
  [Chains.OP]: '0xa',
  [Chains.FTM]: '0xfa',
  [Chains.BLAST]: '0x13e31',
  [Chains.BASE]: '0x2105',
  [Chains.SONIC]: '0x92',
  [Chains.AVAX]: '0xa86a',
}

const ethereum = () => (window as any).ethereum

function chainImgSrc(ch: number | string) {
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
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

function assetImgSrc(asset: number | string) {
  switch (asset) {
    case ASSETS.FTM:
      return chainImgSrc(Chains.FTM)
    case ASSETS.AVAX:
      return chainImgSrc(Chains.AVAX)
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

function platformImgSrc(platform: string) {
  switch (platform) {
    case 'Impermax':
      return assetImgSrc(ASSETS.IBEX)
    case 'Tarot':
      return 'https://www.tarot.to/favicon.ico'
    case 'AAVE':
      return 'https://cdn.freelogovectors.net/wp-content/uploads/2021/12/aavelogo-freelogovectors.net_.png'
    default:
      return 'https://static.thenounproject.com/png/1166209-200.png'
  }
}

function linkToPool(pool: { vault: string, platform: string, chain: Chains, stable: boolean}) {
  switch (pool.platform) {
    case 'Tarot': {
      let chainId
      switch (pool.chain) {
        case Chains.BASE:
          chainId = '8453';
          break
        case Chains.SCROLL:
          chainId = '534352';
          break
        case Chains.OP:
          chainId = '10';
          break
        case Chains.FTM:
          chainId = '250';
          break
        case Chains.SONIC:
          chainId = '146';
          break
        case Chains.AVAX:
          chainId = '43114';
          break
        default:
          throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://tarot.to/lending-pool/${chainId}/${pool.vault.toLowerCase()}`
    }
    case 'Impermax': {
      let chainPrefix
      switch (pool.chain) {
        case Chains.BASE: chainPrefix = 'base'; break
        case Chains.SCROLL: chainPrefix = 'scroll'; break
        case Chains.OP: chainPrefix = 'optimism'; break
        case Chains.FTM: chainPrefix = 'fantom'; break
        case Chains.BLAST: chainPrefix = 'blast'; break
        case Chains.SONIC: chainPrefix = 'sonic'; break
        case Chains.AVAX: chainPrefix = 'avalanche'; break
        default: throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://${chainPrefix}.impermax.finance/lending-pool/${typeof pool.stable === 'boolean' ? pool.stable ? '7' : '6' : '4'}/${pool.vault.toLowerCase()}`
    }
    case 'AAVE':
      let chainName
      switch (pool.chain) {
        case Chains.BASE: chainName = 'base'; break
        case Chains.SCROLL: chainName = 'scroll'; break
        case Chains.OP: chainName = 'optimism'; break
        default: throw new Error(`unknown chain ${pool.chain}`)
      }
      return `https://app.aave.com/?marketName=proto_${chainName}_v3`
    default:
      throw new Error(`Unknown platform ${pool.platform}`)
  }
}

function linkToExplorer(pool: Pool) {
  let chainPrefix
  switch (pool.chain) {
    case Chains.BASE: chainPrefix = 'basescan.org'; break
    case Chains.SCROLL: chainPrefix = 'scrollscan.com'; break
    case Chains.OP: chainPrefix = 'optimistic.etherscan.io'; break
    case Chains.FTM: chainPrefix = 'ftmscan.com'; break
    case Chains.BLAST: chainPrefix = 'blastscan.io'; break
    case Chains.SONIC: chainPrefix = 'sonicscan.org'; break
    case Chains.AVAX: chainPrefix = 'snowscan.xyz'; break
    default: throw new Error(`unknown chain ${pool.chain}`)
  }
  return `https://${chainPrefix}/address/${pool.borrowable}`
}

function extractAddresses(str: string): string[] {
  return str.split(",").map(s => s.replace(" ", ''))
}

function invalidAddresses(str: string) {
  const addresses = extractAddresses(str)

  const addr: { [a: string]: true } = {}
  return addresses.find(a => {
    if (addr[a]) return a
    addr[a] = true
    return !isAddress(a)
  }) !== undefined
}

function toUSDCurrency(n: number | string): string {
  n = String(n)
  const pointIndex = n.indexOf('.')

  let lastIndex
  let s
  if (pointIndex === -1) {
    s = ''
    lastIndex = n.length
  } else {
    lastIndex = pointIndex
    s = n.substring(pointIndex)
  }

  let i
  for (i = lastIndex - 3; i > 0; i -= 3) {
    s = `,${n.substring(i, i + 3)}${s}`
  }


  return `$${n.substring(0, i + 3)}${s}`
}

</script>

<template>
  <h1>{{ msg }}</h1>
  <Card>
    <template #content>
      <InputText v-model="addresses" style="width: 97%" placeholder="input addresses" size="large"/>
    </template>
    <template #footer>
      <div>
        <div v-if="fetchingData" style="text-align: center">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="8" fill="transparent"
                           animationDuration=".5s" aria-label="Custom ProgressSpinner" />
        </div>
        <template v-else>
          <Button label="fetch data" class="w-full" :disabled='invalidAddresses(addresses) || fetchingData' @click="( async() => {
            fetchingData = true
            const userAddresses = addresses
            data = await load(extractAddresses(userAddresses))
            storage().setItem('userStr', userAddresses)
            selectedChains = {}
            selectedAssets = {}
            idleByUser = {}
            idleByAssetByUser = {}
            idleByChainByUser = {}
            idleByChainByAssetByUser = {}
            suppliedByUser = {}
            suppliedByAssetByUser = {}
            suppliedByChainByUser = {}
            suppliedByChainByAssetByUser = {}
            suppliedByChainByBorrowableByUser = {}
            data.poolChains.forEach((ch: string) => {
              selectedChains[ch] = true
            })
            data.poolAssets.forEach((asset: string) => {
              selectedAssets[asset] = true
            })
            fetchingData = false
          } )"></Button>
        </template>
      </div>
    </template>
  </Card>

  <Panel header="Global stats" toggleable class="toggleable-area" :collapsed="collapsed.globals" @update:collapsed="(event) => { setCollapsed('globals', event) }">
      <template v-if="data">
        <Card class="card-chain">
          <template #content>
            <p class="m-0">
              Total deposited: {{toUSDCurrency(data.totalDeposited)}}
              <label
                  style="cursor: pointer"
                  v-if="data.users.length > 1"
                  @click="showDepositByUser"
              >ℹ️</label>
            </p>
            <Popover ref="suppliedByUser">
                <div v-for="(usd, address) in data.suppliedByUser" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
            </Popover>
            <p class="m-0">
              Daily earnings: {{ toUSDCurrency(data.oldTotalEarnings) }} -> {{ toUSDCurrency(data.maxTotalEarnings) }}
            </p>
            <p class="m-0">
              APR: {{data.currentAPR}}% -> {{data.maxAPR}}%
            </p>
            <p class="m-0">
              Idle: {{ toUSDCurrency(data.usd) }}
              <label
                  style="cursor: pointer"
                  v-if="data.users.length > 1"
                  @click="showIdleByUser"
              >ℹ️</label>
            </p>
            <Popover ref="idleByUser">
                <div v-for="(usd, address) in data.idleBalancesByUser" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
            </Popover>
          </template>
        </Card>
      </template>
  </Panel>

  <Panel header="L&B positions" class="toggleable-area" toggleable  :collapsed="collapsed.lending" @update:collapsed="(event) => { setCollapsed('lending', event) }">
      <div class="asset-summarized-info">
        <template v-if="data" v-for="(chainProps, chain) in data.compoundBorrowingInfo" :key="chain">
         <template v-if="data" v-for="(marketProps, market) in chainProps" :key="market">
          <template v-if="data" v-for="(positionProps, user) in marketProps.positions" :key="user">
            <Card class="card-chain">
              <template #title>
                <Image :src='assetImgSrc(marketProps.asset)' :alt='marketProps.asset' width="50px" />
              </template>
              <template #subtitle> {{user}} </template>
              <template #content>
                Supplied: {{toUSDCurrency(positionProps.collateralTotalUsd)}}
                <template v-for="(collateralProps, collateral) in marketProps.collaterals">
                  <template v-if="collateralProps[user] && collateralProps[user].bn > 0">
                    <div><span style="color: gray">{{ collateralProps[user].amount }} {{marketProps.collateralToAsset[collateral]}} ({{toUSDCurrency(collateralProps[user].usd)}})</span></div>
                  </template>
                </template>

                <div>Borrowed: {{marketProps.borrowed[user].amount}} {{marketProps.asset}} ({{toUSDCurrency(marketProps.borrowed[user].usd)}})</div>
                <div>Daily borrowing cost: {{marketProps.spendings[user].amount}} {{marketProps.asset}} ({{toUSDCurrency(marketProps.spendings[user].usd)}})</div>
                <div>Daily reward: {{marketProps.rewards[user].amount}} {{ASSETS.COMP}} ({{toUSDCurrency(marketProps.rewards[user].usd)}})</div>
                <div>Resulting APR: {{positionProps.apr}}%</div>
                <div>Health factor: {{positionProps.healthFactor}}</div>
                <div>Liquidation price: {{toUSDCurrency(positionProps.liquidationPrice)}} (current: {{toUSDCurrency(marketProps.assetPrice)}})</div>
              </template>
            </Card>
          </template>
         </template>
        </template>
        <template v-if="data" v-for="(positionProps, userChain) in data.aavePositions" :key="userChain">
          <Card class="card-chain">
            <template #title>
              <Image :src='platformImgSrc("AAVE")' alt="AAVE" width="50px" />
              <Image :src='chainImgSrc((userChain as unknown as string).substring(42))' :alt='chain' width="50px" />
            </template>
            <template #subtitle> {{(userChain as unknown as string).substring(0, 42)}} </template>
            <template #content>
              Supplied: {{toUSDCurrency(positionProps.collateralTotalUsd)}}
              <template v-for="(collateralProps, asset) in positionProps.collaterals">
                <template v-if="collateralProps.bn > 0">
                  <div><span style="color: gray">{{ collateralProps.amount }} {{asset}} ({{toUSDCurrency(collateralProps.usd)}})</span></div>
                </template>
              </template>

              <div>Borrowed: {{toUSDCurrency(positionProps.borrowedTotalUsd)}}</div>
              <template v-for="(borrowProps, asset) in positionProps.borrows">
                <template v-if="borrowProps.bn > 0">
                  <div><span style="color: gray">{{ borrowProps.amount }} {{asset}} ({{toUSDCurrency(borrowProps.usd)}})</span></div>
                </template>
              </template>
              <div>Daily borrowing cost: {{toUSDCurrency(positionProps.spendings)}}</div>
              <div>Daily earnings: {{toUSDCurrency(positionProps.earnings)}}</div>
              <div>Resulting APR: {{positionProps.apr}}%</div>
              <div>Health factor: {{positionProps.healthFactor}}</div>

              <div style="display: flex; justify-content: center; align-items: center;">
                <Button as="a" label="Go to AAVE" severity="secondary" outlined class="w-full" :href='linkToPool({ vault: "", platform: "AAVE", stable: false, chain: (userChain as unknown as string).substring(42) as Chains })' target="_blank" rel="noopener" />
              </div>
            </template>
          </Card>
        </template>
      </div>
  </Panel>

  <Panel header="Liquidity by assets" class="toggleable-area" toggleable  :collapsed="collapsed.assets" @update:collapsed="(event) => { setCollapsed('assets', event) }">
      <div class="asset-summarized-info">
        <template v-if="data" v-for="(assetProps, asset, index) in data.cumulativeValuesByAsset" :key="asset">
          <Card class="card-chain">
            <template #title>
              <Image :src='assetImgSrc(asset)' :alt='asset' width="50px" />
            </template>
            <template #content>
              <p class="m-0">
                Supplied: {{assetProps.newUserSupplied}} ({{toUSDCurrency(assetProps.newUserSuppliedUsd)}})
                <label
                    style="cursor: pointer"
                    v-if="data.users.length > 1 && data.suppliedByAssetByUser[asset]"
                    @click="event => showDepositByAssetByUser(asset, event)">ℹ️
                </label>
              </p>
              <Popover :ref="(el: any) => { suppliedByAssetByUser[asset] = el }" :key="asset">
                  <div v-for="({ amount, usd }, address) in data.suppliedByAssetByUser[asset]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{amount}} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
              </Popover>
              <p class="m-0">
                Daily earnings: {{ assetProps.oldDailyEarnings }} ({{toUSDCurrency(assetProps.oldDailyEarningsUsd)}}) -> {{ assetProps.maxDailyEarnings }} ({{toUSDCurrency(assetProps.maxDailyEarningsUsd)}})
                <span style="color: green" v-if="data.compoundBorrowingRewardByBorrowedAsset[asset]"> +{{data.compoundBorrowingRewardByBorrowedAsset[asset].amount}} {{ASSETS.COMP}} ({{toUSDCurrency(data.compoundBorrowingRewardByBorrowedAsset[asset].usd)}})</span>
              </p>
              <p class="m-0">
                APR: {{assetProps.currentAPR}}% -> {{assetProps.maxAPR}}%
              </p>
              <p class="m-0">
                Idle: {{data.idleBalancesByAsset[asset].amount}} ({{toUSDCurrency(data.idleBalancesByAsset[asset].usd)}})
                <label
                    style="cursor: pointer"
                    v-if="data.users.length > 1 && data.idleBalancesByAssetByUser[asset] && Object.keys(data.idleBalancesByAssetByUser[asset]).length"
                    @click="(event) => showIdleByAssetByUser(index, event)"
                >ℹ️</label>
              </p>
              <Popover ref="idleByAssetByUser">
                <div v-for="({ amount, usd }, address) in data.idleBalancesByAssetByUser[asset]" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                  </div>
                </div>
              </Popover>
            </template>
          </Card>
        </template>
      </div>
  </Panel>

  <Panel header="Liquidity by chains" class="toggleable-area" toggleable  :collapsed="collapsed.chains" @update:collapsed="(event) => { setCollapsed('chains', event) }">
      <div class="chain-summarized-info">
        <template v-if="data" v-for="(chainProps, chain, index) in data.cumulativeValuesByChains">
          <Card class="card-chain">
            <template #title style="text-align: center" >
            <Image :src='chainImgSrc(chain)' :alt='chain' width="50px" />
            </template>
            <template #content>
              <p class="m-0">
                Total supplied: {{toUSDCurrency(data.chainAggregatedStats[chain].newUserSuppliedUsd)}}
                <label
                    style="cursor: pointer"
                    v-if="data.users.length > 1 && data.suppliedByChainByUser[chain]"
                    @click="event => showDepositByChainByUser(index, event)">ℹ️
                </label>
              </p>
              <Popover ref="suppliedByChainByUser">
                  <div v-for="(usd, address) in data.suppliedByChainByUser[chain]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                    </div>
                  </div>
              </Popover>
              <p class="m-0">
                Daily earnings: {{toUSDCurrency(data.chainAggregatedStats[chain].oldDailyEarningsUsd)}} -> {{toUSDCurrency(data.chainAggregatedStats[chain].maxDailyEarningsUsd)}}
              </p>
              <p class="m-0">
                APR: {{data.chainAggregatedStats[chain].currentAPR}}% -> {{data.chainAggregatedStats[chain].maxAPR}}%
              </p>
              <p class="m-0">
                Idle: {{toUSDCurrency(data.chainAggregatedStats[chain].usd)}}
                <label
                    style="cursor: pointer"
                    v-if="data.users.length > 1"
                    @click="(event) => showIdleByChainByUser(index, event)">ℹ️</label>
              </p>
              <Popover ref="idleByChainByUser">
                <div v-for="(usd, address) in data.idleBalancesByChainByUser[chain]" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
              </Popover>
              <Panel header="Assets" toggleable collapsed>
                <template v-for="(assetProps, asset) in chainProps">
                  <Card class="card-asset">
                    <template #title>
                      <Image :src='assetImgSrc(asset)' :alt='asset' width="30px" />
                    </template>
                    <template #content>
                      <p class="m-0">
                        Supplied: {{assetProps.newUserSupplied}} ({{toUSDCurrency(assetProps.newUserSuppliedUsd)}})
                        <label
                            style="cursor: pointer"
                            v-if="data.users.length > 1 && data.suppliedByChainByAssetByUser[chain] && data.suppliedByChainByAssetByUser[chain][asset]"
                            @click="event => showDepositByChainByAssetByUser(chain, asset, event)"
                        >ℹ️</label>
                      </p>
                      <Popover :ref="(el: any) => { (suppliedByChainByAssetByUser as any)[chain + asset] = el }" :key="chain + asset">
                        <div v-for="({ amount, usd }, address) in data.suppliedByChainByAssetByUser[chain][asset]" :key="address" class="flex items-center gap-2">
                          <div>
                            <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                          </div>
                        </div>
                      </Popover>
                      <p class="m-0">
                        Daily earnings: {{ assetProps.oldDailyEarnings }} ({{toUSDCurrency(assetProps.oldDailyEarningsUsd)}}) -> {{ assetProps.maxDailyEarnings }} ({{toUSDCurrency(assetProps.maxDailyEarningsUsd)}})
                      </p>
                      <p class="m-0">
                        APR: {{assetProps.currentAPR}}% -> {{assetProps.maxAPR}}%
                      </p>
                      <p class="m-0">
                        Idle: {{data.idleBalancesByChain[chain][asset].amount}} ({{toUSDCurrency(data.idleBalancesByChain[chain][asset].usd)}})
                        <label
                            style="cursor: pointer"
                            v-if="data.users.length > 1 && data.idleBalancesByChainByAssetByUser[chain] && data.idleBalancesByChainByAssetByUser[chain][asset]"
                            @click="event => showIdleByChainByAssetByUser(chain, asset, event)">ℹ️
                        </label>
                      </p>
                      <Popover :ref="(el: any) => { (idleByChainByAssetByUser as any)[chain + asset] = el }" :key="chain + asset">
                        <span class="font-medium block mb-2">Idle {{asset}} balances on {{chain}}</span>
                        <div v-for="({ amount, usd }, address) in data.idleBalancesByChainByAssetByUser[chain][asset]" :key="address" class="flex items-center gap-2">
                          <div>
                            <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                          </div>
                        </div>
                      </Popover>
                    </template>
                  </Card>
                </template>
              </Panel>
            </template>
          </Card>
        </template>
      </div>
  </Panel>

  <Card class="card-block">
    <template #subtitle v-if="data">
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap">
          <div style="text-align: left">
            <div style="margin-bottom: 5px; text-align: left">
              <label>My deposits</label>
            </div>
            <ToggleSwitch v-model="onlyMyDeposits" />
          </div>
          <div>
            <div style="margin-bottom: 5px; text-align: left">
              <label>Select chains</label>
            </div>
            <div>
              <component v-for="chain in data.poolChains" @click="toggleChainSelected(chain)">
                <Image :src='chainImgSrc(chain)' :alt='chain' width="30px"
                 :style="`border-radius: 100%; box-shadow: 0 3px 7px -6px black; margin-right: 10px; opacity: ${selectedChains[chain] ? '100%' : '10%'}; cursor: pointer`"
                />
              </component>
            </div>
          </div>
          <div>
            <div style="margin-bottom: 5px; text-align: left">
              <label>Select assets</label>
            </div>
            <div>
              <component v-for="asset in data.poolAssets" @click="toggleAssetSelected(asset)">
                <Image :src='assetImgSrc(asset)' :alt='asset' width="30px"
                 :style="`border-radius: 100%; box-shadow: 0 3px 7px -6px black; margin-right: 10px; opacity: ${selectedAssets[asset] ? '100%' : '10%'}; cursor: pointer`"
                />
              </component>
            </div>
          </div>
        </div>
    </template>
    <template #content>
      <div class="asset-summarized-info">
        <template v-if="data" v-for="pool in data.goodPools">
          <Card class="card-pool" v-if="selectedChains[pool.chain] && selectedAssets[pool.asset] && (!onlyMyDeposits || pool.suppliedBN > 0)">
            <template #title>{{pool.platform === 'AAVE' ? '' : 'Collateral:'}} {{pool.asset}}{{pool.oppositeSymbol ? '/' : ''}}{{pool.oppositeSymbol}} ({{pool.vaultAPR === '' ? 'AAVE' : pool.vaultAPR + '%'}})</template>
            <template #subtitle>
              <a target="_blank" rel="noopener" :href="linkToExplorer(pool)" style="font-family: monospace">{{pool.borrowable}}</a>
            </template>
            <template #content>
              <p class="m-0">
                Supplied: {{pool.supplied}} ({{toUSDCurrency(pool.suppliedUsd)}})
                <label
                    style="cursor: pointer"
                    v-if="data.users.length > 1 && data.suppliedByChainByBorrowableByUser[pool.chain] && data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]"
                    @click="event => showDepositByChainByAssetByBorrowableByUser(pool.chain, pool.borrowable, event)">ℹ️
                </label>
              </p>
              <Popover :ref="(el: any) => { (suppliedByChainByBorrowableByUser as any)[pool.chain + pool.borrowable] = el }" :key="pool.chain + pool.borrowable">
                <div v-for="({ amount, usd }, address) in data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]" :key="address" class="flex items-center gap-2">
                  <div>
                    <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                  </div>
                </div>
              </Popover>
              <p class="m-0">
                Daily earnings: {{ pool.earningsOld }} ({{toUSDCurrency(pool.earningsOldUsd)}}) -> {{ pool.earningsNew }} ({{toUSDCurrency(pool.earningsNewUsd)}})
                <span style="color: green" v-if="pool.stakingDailyEarnings"> +{{pool.stakingDailyEarnings}} {{pool.stakingRewardAsset}} ({{toUSDCurrency(pool.stakingDailyEarningsUsd)}})</span>
              </p>
              <p class="m-0">
                APR: {{pool.aprOld}}% -> {{pool.aprNew}}%
                <span style="color: green" v-if="pool.stakingAPR"> +{{pool.stakingAPR}}% ({{pool.stakingRewardAsset}})</span>
                <label v-if="(
                    (
                        data.cumulativeValuesByAsset[pool.asset] && data.cumulativeValuesByAsset[pool.asset].newUserSupplied > 0) ||
                        (data.idleBalancesByAsset[pool.asset] && data.idleBalancesByAsset[pool.asset].amount > 0)
                    ) && (pool.aprNew + pool.stakingAPR) > data.cumulativeValuesByAsset[pool.asset].maxAPR">🔥</label>
              </p>
              <p class="m-0">
                Utilization: {{pool.utilization}}% / {{pool.kink}}%
              </p>
              <p class="m-0">
                Capacity: {{pool.availableToDeposit}} ({{toUSDCurrency(pool.availableToDepositUsd)}})
                <label
                  v-if="pool.availableToDepositUsd > 1_000"
                >👀</label>
                <label
                    style="cursor: pointer"
                    v-if="pool.availableToDepositUsd > 10 && (data.idleBalancesByChain[pool.chain][pool.asset] && data.idleBalancesByChain[pool.chain][pool.asset].usd > 10)"
                    @click="event => showIdleByChainByAssetByUser(pool.chain, pool.asset, event)"
                >ℹ️</label>
              </p>
              <p class="m-0">
                TVL: {{pool.tvl}} ({{toUSDCurrency(pool.tvlUsd)}})
              </p>
            </template>
            <template #footer>
                <div style="display: flex; justify-content: center; align-items: center;">
                    <Button as="a" label="Go to pool" severity="secondary" outlined class="w-full" :href='linkToPool(pool)' target="_blank" rel="noopener" />
                    <Button v-if='ethereum() && pool.earningsNewUsd > pool.earningsOldUsd' @click='(async () => {
                      if (ethereum()) {
                        if (!subscribed) {
                          ethereum().on("accountsChanged", async () => {
                              const [addr] = await ethereum().enable()
                              wallet = addr
                              chain = ethereum().chainId
                              console.log(`account switched to ${addr}`)
                          })
                          ethereum().on("networkChanged", async () => {
                              const [addr] = await ethereum().enable()
                              wallet = addr
                              chain = ethereum().chainId
                              console.log(`chain switched to ${chain}`)
                          })
                          console.log(`subscribed to wallet events`)
                          subscribed = true
                        }
                        const [addr] = await ethereum().enable()
                        if (wallet !== addr) {
                          wallet = addr
                          console.log("wallet connected", wallet)
                          chain = ethereum().chainId
                        } else if (chainIdByChain[pool.chain as Chains] !== chain) {
                          await ethereum().request({
                           "method": "wallet_switchEthereumChain",
                           "params": [
                            {
                              chainId: chainIdByChain[pool.chain as Chains]
                            }
                          ],
                          })
                          chain = ethereum().chainId
                        } else {
                          ethereum().request({
                            "method": "eth_sendTransaction",
                            "params": [
                              {
                                  from: wallet,
                                  to: pool.borrowable,
                                  data: "0xfff6cae9",
                                  value: `0x`,
                                  chainId: chainIdByChain[pool.chain as Chains],
                              }
                            ]
                          });
                        }
                        }
                    })' :label='ethereum() ? wallet ? chain === chainIdByChain[pool.chain as Chains] ? "sync" : `switch n to ${pool.chain}` : "connect wallet" : "no wallet detected"' class="w-full" />
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between">
                  <div>
                    <Image :src='chainImgSrc(pool.chain)' :alt='pool.chain' width="25px"/>
                    <Image :src='platformImgSrc(pool.platform)' :alt='pool.platform' width="25px"/>
                  </div>
                  <Image :src='assetImgSrc(pool.asset)' :alt='pool.asset' width="25px"/>
                </div>
            </template>
          </Card>
        </template>
      </div>
    </template>
  </Card>
</template>

<style scoped>

.chain-summarized-info {
  margin: 1rem;
  display: flex;
  flex-wrap: wrap;
}

.toggleable-area {
  margin: 1rem;
  min-width: 570px;
}

.card-block {
  margin: 1rem;
  flex-wrap: wrap;
  min-width: 570px;
}

.asset-summarized-info {
  margin: 1rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.card-chain {
  flex: 0 1 max(32%, 300px);
  margin: 5px;
}

.card-pool {
  margin: 5px;
  width: 365px;
}

.card-asset {
  flex: 0 1 max(32%, 300px);
  margin: 5px;
}

</style>
