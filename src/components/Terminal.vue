<script setup lang="ts">
import {computed, ref, type Ref} from 'vue'
import load from "../logic/load";
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Image from 'primevue/image';
import ProgressSpinner from 'primevue/progressspinner';
import Panel from 'primevue/panel';
import {ASSETS, Chains} from "../constants/constants";
import ToggleSwitch from 'primevue/toggleswitch';
import {Pool} from "../types";
import {toUSDCurrency, extractAddresses, invalidAddresses} from "../utils/formatting";
import {chainIdByChain, chainImgSrc, assetImgSrc, platformImgSrc, linkToPool, linkToExplorer} from "../utils/chainMappings";
import StatWithBreakdown from './StatWithBreakdown.vue';

defineProps<{ msg: string }>()

const fetchingData = ref(false)
const subscribed = ref(false)
const addresses = ref(localStorage.getItem('userStr') || '')
const data: any = ref<Awaited<ReturnType<typeof load>>>()
const wallet = ref('')
const walletChain = ref('')
const collapsed = ref({
  'globals': localStorage.getItem('collapsed.globals') !== 'false',
  'chains': localStorage.getItem('collapsed.chains') !== 'false',
  'assets': localStorage.getItem('collapsed.assets') !== 'false',
  'lending': localStorage.getItem('collapsed.lending') !== 'false'
})

const selectedChains = ref<{ [chain: string]: boolean }>({});
const selectedAssets = ref<{ [asset: string]: boolean }>({});

const onlyMyDeposits = ref(false);

const hasEthereum = computed(() => !!(window as any).ethereum)

const setCollapsed = (id: string, state: boolean) => {
  (collapsed as any).value[id] = state;
  localStorage.setItem(`collapsed.${id}`, String(state))
}

function toggleFilterSelection(
  key: string,
  selectedMap: Ref<{ [k: string]: boolean }>,
  allKeys: string[],
) {
  let allSelected = true
  let selectedCount = 0
  let selectedKey
  Object.entries(selectedMap.value).forEach(([k, flag]) => {
    if (flag) {
      selectedKey = k
      selectedCount++
    } else {
      allSelected = false
    }
    return !allSelected && selectedCount > 1
  })
  if (allSelected) {
    allKeys.forEach((k: string) => {
      if (key === k) return
      selectedMap.value[k] = false
    })
  } else if (selectedCount === 1 && key === selectedKey) {
    allKeys.forEach((k: string) => {
      selectedMap.value[k] = true
    })
  } else {
    selectedMap.value[key] = !selectedMap.value[key]
  }
}

const toggleChainSelected = (chain: string) =>
  toggleFilterSelection(chain, selectedChains, data.value.poolChains)

const toggleAssetSelected = (asset: string) =>
  toggleFilterSelection(asset, selectedAssets, data.value.poolAssets)

async function fetchData() {
  fetchingData.value = true
  const userAddresses = addresses.value
  data.value = await load(extractAddresses(userAddresses))
  localStorage.setItem('userStr', userAddresses)
  selectedChains.value = {}
  selectedAssets.value = {}
  data.value.poolChains.forEach((ch: string) => {
    selectedChains.value[ch] = true
  })
  data.value.poolAssets.forEach((asset: string) => {
    selectedAssets.value[asset] = true
  })
  fetchingData.value = false
}

async function handleSyncOrConnect(pool: Pool) {
  const ethereum = (window as any).ethereum
  if (!ethereum) return
  if (!subscribed.value) {
    ethereum.on("accountsChanged", async () => {
      const [addr] = await ethereum.enable()
      wallet.value = addr
      walletChain.value = ethereum.chainId
      console.log(`account switched to ${addr}`)
    })
    ethereum.on("networkChanged", async () => {
      const [addr] = await ethereum.enable()
      wallet.value = addr
      walletChain.value = ethereum.chainId
      console.log(`chain switched to ${walletChain.value}`)
    })
    console.log(`subscribed to wallet events`)
    subscribed.value = true
  }
  const [addr] = await ethereum.enable()
  if (wallet.value !== addr) {
    wallet.value = addr
    console.log("wallet connected", wallet.value)
    walletChain.value = ethereum.chainId
  } else if (chainIdByChain[pool.chain as Chains] !== walletChain.value) {
    await ethereum.request({
      "method": "wallet_switchEthereumChain",
      "params": [{ chainId: chainIdByChain[pool.chain as Chains] }],
    })
    walletChain.value = ethereum.chainId
  } else {
    ethereum.request({
      "method": "eth_sendTransaction",
      "params": [{
        from: wallet.value,
        to: pool.borrowable,
        data: "0xfff6cae9",
        value: `0x`,
        chainId: chainIdByChain[pool.chain as Chains],
      }]
    });
  }
}

function syncButtonLabel(pool: Pool): string {
  if (!hasEthereum.value) return "no wallet detected"
  if (!wallet.value) return "connect wallet"
  if (walletChain.value === chainIdByChain[pool.chain as Chains]) return "sync"
  return `switch n to ${pool.chain}`
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
          <Button label="fetch data" class="w-full" :disabled='invalidAddresses(addresses) || fetchingData' @click="fetchData"></Button>
        </template>
      </div>
    </template>
  </Card>

  <Panel header="Global stats" toggleable class="toggleable-area" :collapsed="collapsed.globals" @update:collapsed="(event) => { setCollapsed('globals', event) }">
      <template v-if="data">
        <Card class="card-chain">
          <template #content>
            <StatWithBreakdown :showBreakdown="data.users.length > 1">
              Total deposited: {{toUSDCurrency(data.totalDeposited)}}
              <template #breakdown>
                <div v-for="(usd, address) in data.suppliedByUser" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
            <p class="m-0">
              Daily earnings: {{ toUSDCurrency(data.oldTotalEarnings) }} -> {{ toUSDCurrency(data.maxTotalEarnings) }}
            </p>
            <p class="m-0">
              APR: {{data.currentAPR}}% -> {{data.maxAPR}}%
            </p>
            <StatWithBreakdown :showBreakdown="data.users.length > 1">
              Idle: {{ toUSDCurrency(data.usd) }}
              <template #breakdown>
                <div v-for="(usd, address) in data.idleBalancesByUser" :key="address" class="flex items-center gap-2">
                  <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
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
              <Image :src='chainImgSrc((userChain as unknown as string).substring(42))' :alt='(userChain as unknown as string).substring(42)' width="50px" />
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
        <template v-if="data" v-for="(assetProps, asset) in data.cumulativeValuesByAsset" :key="asset">
          <Card class="card-chain">
            <template #title>
              <Image :src='assetImgSrc(asset)' :alt='asset' width="50px" />
            </template>
            <template #content>
              <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByAssetByUser[asset]">
                Supplied: {{assetProps.newUserSupplied}} ({{toUSDCurrency(assetProps.newUserSuppliedUsd)}})
                <template #breakdown>
                  <div v-for="({ amount, usd }, address) in data.suppliedByAssetByUser[asset]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{amount}} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <p class="m-0">
                Daily earnings: {{ assetProps.oldDailyEarnings }} ({{toUSDCurrency(assetProps.oldDailyEarningsUsd)}}) -> {{ assetProps.maxDailyEarnings }} ({{toUSDCurrency(assetProps.maxDailyEarningsUsd)}})
                <span style="color: green" v-if="data.compoundBorrowingRewardByBorrowedAsset[asset]"> +{{data.compoundBorrowingRewardByBorrowedAsset[asset].amount}} {{ASSETS.COMP}} ({{toUSDCurrency(data.compoundBorrowingRewardByBorrowedAsset[asset].usd)}})</span>
                <span style="color: green" v-if="data.morphoRewardsByAsset[asset]"> +{{data.morphoRewardsByAsset[asset].amount}} {{ASSETS.WLD}} ({{toUSDCurrency(data.morphoRewardsByAsset[asset].usd)}})</span>
              </p>
              <p class="m-0">
                APR: {{assetProps.currentAPR}}% -> {{assetProps.maxAPR}}%
              </p>
              <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.idleBalancesByAssetByUser[asset] && Object.keys(data.idleBalancesByAssetByUser[asset]).length > 0">
                Idle: {{data.idleBalancesByAsset[asset].amount}} ({{toUSDCurrency(data.idleBalancesByAsset[asset].usd)}})
                <template #breakdown>
                  <div v-for="({ amount, usd }, address) in data.idleBalancesByAssetByUser[asset]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
            </template>
          </Card>
        </template>
      </div>
  </Panel>

  <Panel header="Liquidity by chains" class="toggleable-area" toggleable  :collapsed="collapsed.chains" @update:collapsed="(event) => { setCollapsed('chains', event) }">
      <div class="chain-summarized-info">
        <template v-if="data" v-for="(chainProps, chain) in data.cumulativeValuesByChains">
          <Card class="card-chain">
            <template #title style="text-align: center" >
            <Image :src='chainImgSrc(chain)' :alt='chain' width="50px" />
            </template>
            <template #content>
              <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByChainByUser[chain]">
                Total supplied: {{toUSDCurrency(data.chainAggregatedStats[chain].newUserSuppliedUsd)}}
                <template #breakdown>
                  <div v-for="(usd, address) in data.suppliedByChainByUser[chain]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <p class="m-0">
                Daily earnings: {{toUSDCurrency(data.chainAggregatedStats[chain].oldDailyEarningsUsd)}} -> {{toUSDCurrency(data.chainAggregatedStats[chain].maxDailyEarningsUsd)}}
              </p>
              <p class="m-0">
                APR: {{data.chainAggregatedStats[chain].currentAPR}}% -> {{data.chainAggregatedStats[chain].maxAPR}}%
              </p>
              <StatWithBreakdown :showBreakdown="data.users.length > 1">
                Idle: {{toUSDCurrency(data.chainAggregatedStats[chain].usd)}}
                <template #breakdown>
                  <div v-for="(usd, address) in data.idleBalancesByChainByUser[chain]" :key="address" class="flex items-center gap-2">
                    <div>
                        <span style="font-family: monospace">{{ address }}</span>: <span>{{ toUSDCurrency(usd) }}</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <Panel header="Assets" toggleable collapsed>
                <template v-for="(assetProps, asset) in chainProps">
                  <Card class="card-asset">
                    <template #title>
                      <Image :src='assetImgSrc(asset)' :alt='asset' width="30px" />
                    </template>
                    <template #content>
                      <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByChainByAssetByUser[chain] && !!data.suppliedByChainByAssetByUser[chain][asset]">
                        Supplied: {{assetProps.newUserSupplied}} ({{toUSDCurrency(assetProps.newUserSuppliedUsd)}})
                        <template #breakdown>
                          <div v-for="({ amount, usd }, address) in data.suppliedByChainByAssetByUser[chain][asset]" :key="address" class="flex items-center gap-2">
                            <div>
                              <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                            </div>
                          </div>
                        </template>
                      </StatWithBreakdown>
                      <p class="m-0">
                        Daily earnings: {{ assetProps.oldDailyEarnings }} ({{toUSDCurrency(assetProps.oldDailyEarningsUsd)}}) -> {{ assetProps.maxDailyEarnings }} ({{toUSDCurrency(assetProps.maxDailyEarningsUsd)}})
                      </p>
                      <p class="m-0">
                        APR: {{assetProps.currentAPR}}% -> {{assetProps.maxAPR}}%
                      </p>
                      <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.idleBalancesByChainByAssetByUser[chain] && !!data.idleBalancesByChainByAssetByUser[chain][asset]">
                        Idle: {{data.idleBalancesByChain[chain][asset].amount}} ({{toUSDCurrency(data.idleBalancesByChain[chain][asset].usd)}})
                        <template #breakdown>
                          <span class="font-medium block mb-2">Idle {{asset}} balances on {{chain}}</span>
                          <div v-for="({ amount, usd }, address) in data.idleBalancesByChainByAssetByUser[chain][asset]" :key="address" class="flex items-center gap-2">
                            <div>
                              <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                            </div>
                          </div>
                        </template>
                      </StatWithBreakdown>
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
            <template #title>{{pool.platform === 'AAVE' ? '' : 'Collateral:'}} {{pool.asset}}{{pool.oppositeSymbol ? '/' : ''}}{{pool.oppositeSymbol}} ({{pool.vaultAPR === '' ? pool.platform : pool.vaultAPR + '%'}})</template>
            <template #subtitle>
              <a target="_blank" rel="noopener" :href="linkToExplorer(pool)" style="font-family: monospace">{{pool.borrowable}}</a>
            </template>
            <template #content>
              <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByChainByBorrowableByUser[pool.chain] && !!data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]">
                Supplied: {{pool.supplied}} ({{toUSDCurrency(pool.suppliedUsd)}})
                <template #breakdown>
                  <div v-for="({ amount, usd }, address) in data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]" :key="address" class="flex items-center gap-2">
                    <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
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
              <StatWithBreakdown :showBreakdown="pool.availableToDepositUsd > 10 && !!data.idleBalancesByChain[pool.chain][pool.asset] && data.idleBalancesByChain[pool.chain][pool.asset].usd > 10">
                Capacity: {{pool.availableToDeposit}} ({{toUSDCurrency(pool.availableToDepositUsd)}})
                <label v-if="pool.availableToDepositUsd > 1_000">👀</label>
                <template #breakdown>
                  <div v-for="({ amount, usd }, address) in data.idleBalancesByChainByAssetByUser?.[pool.chain]?.[pool.asset]" :key="address" class="flex items-center gap-2">
                    <div>
                      <span style="font-family: monospace">{{ address }}</span>: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <p class="m-0">
                TVL: {{pool.tvl}} ({{toUSDCurrency(pool.tvlUsd)}})
              </p>
            </template>
            <template #footer>
                <div style="display: flex; justify-content: center; align-items: center;">
                    <Button as="a" label="Go to pool" severity="secondary" outlined class="w-full" :href='linkToPool(pool)' target="_blank" rel="noopener" />
                    <Button v-if='hasEthereum && pool.earningsNewUsd > pool.earningsOldUsd' @click='handleSyncOrConnect(pool)' :label='syncButtonLabel(pool)' class="w-full" />
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
