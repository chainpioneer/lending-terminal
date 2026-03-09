<script setup lang="ts">
import { computed, onMounted, ref, type Ref } from 'vue'
import load from '../logic/load'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Image from 'primevue/image'
import ProgressSpinner from 'primevue/progressspinner'
import Panel from 'primevue/panel'
import { ASSETS, CHAIN_CONF, Chains, getDiv } from '../constants/constants'
import ToggleSwitch from 'primevue/toggleswitch'
import { Pool } from '../types'
import {
  getRouterAddress,
  encodeMint,
  encodeMintETH,
  encodeRedeem,
  encodeRedeemETH,
  ensureApproval,
  sendTx,
  waitForReceipt,
} from '../logic/router'
import ONE from '../utils/ONE'
import { toUSDCurrency, extractAddresses, invalidAddresses } from '../utils/formatting'
import { getAddress } from 'ethers'
import {
  chainIdByChain,
  chainImgSrc,
  assetImgSrc,
  platformImgSrc,
  linkToPool,
  linkToExplorer,
} from '../utils/chainMappings'
import StatWithBreakdown from './StatWithBreakdown.vue'

defineProps<{ msg: string }>()

const fetchingData = ref(false)
const pendingChains = ref<string[]>([])
const addresses = ref(localStorage.getItem('userStr') || '')
const data: any = ref<Awaited<ReturnType<typeof load>>>()
const wallet = ref('')
const walletChain = ref('')
const collapsed = ref({
  globals: localStorage.getItem('collapsed.globals') !== 'false',
  chains: localStorage.getItem('collapsed.chains') !== 'false',
  assets: localStorage.getItem('collapsed.assets') !== 'false',
  lending: localStorage.getItem('collapsed.lending') !== 'false',
})

const selectedChains = ref<{ [chain: string]: boolean }>({})
const selectedAssets = ref<{ [asset: string]: boolean }>({})

const onlyMyDeposits = ref(false)

const poolAction = ref<{ [borrowable: string]: 'deposit' | 'withdraw' | null }>({})
const poolAmountInput = ref<{ [borrowable: string]: string }>({})
const poolTxStatus = ref<{ [borrowable: string]: string }>({})

const hasEthereum = computed(() => !!(window as any).ethereum)
const showRewards = computed(() => wallet.value && data.value?.users?.includes(wallet.value))

onMounted(() => {
  const ethereum = (window as any).ethereum
  if (!ethereum) return
  ethereum.on('accountsChanged', (accounts: string[]) => {
    console.log('accountsChanged', accounts)
    if (accounts[0]) {
      wallet.value = getAddress(accounts[0])
    }
  })
  ethereum.on('chainChanged', (chainId: string) => {
    console.log('chainChanged', chainId)
    walletChain.value = chainId
  })
})

function isImpermaxOrTarot(pool: Pool): boolean {
  return (pool.platform === 'Tarot' || pool.platform === 'Impermax') && !!getRouterAddress(pool.chain)
}

const setCollapsed = (id: string, state: boolean) => {
  ;(collapsed as any).value[id] = state
  localStorage.setItem(`collapsed.${id}`, String(state))
}

function toggleFilterSelection(key: string, selectedMap: Ref<{ [k: string]: boolean }>, allKeys: string[]) {
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

const toggleChainSelected = (chain: string) => toggleFilterSelection(chain, selectedChains, data.value.poolChains)

const toggleAssetSelected = (asset: string) => toggleFilterSelection(asset, selectedAssets, data.value.poolAssets)

async function fetchData() {
  fetchingData.value = true
  data.value = undefined
  const allChains = Object.keys(CHAIN_CONF)
  pendingChains.value = [...allChains]
  const userAddresses = addresses.value
  data.value = await load(extractAddresses(userAddresses), (chain) => {
    pendingChains.value = pendingChains.value.filter((c) => c !== chain)
  })
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
  const [addr] = await ethereum.enable()
  if (wallet.value !== getAddress(addr)) {
    wallet.value = getAddress(addr)
    console.log('wallet connected', wallet.value)
    walletChain.value = ethereum.chainId
  } else if (chainIdByChain[pool.chain as Chains] !== walletChain.value) {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdByChain[pool.chain as Chains] }],
    })
    walletChain.value = ethereum.chainId
  } else {
    ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: wallet.value,
          to: pool.borrowable,
          data: '0xfff6cae9',
          value: `0x`,
          chainId: chainIdByChain[pool.chain as Chains],
        },
      ],
    })
  }
}

function syncButtonLabel(pool: Pool): string {
  if (!hasEthereum.value) return 'no wallet detected'
  if (!wallet.value) return 'connect wallet'
  if (walletChain.value === chainIdByChain[pool.chain as Chains]) return 'sync'
  return `switch n to ${pool.chain}`
}

function togglePoolAction(pool: Pool, action: 'deposit' | 'withdraw') {
  poolAction.value[pool.borrowable] = poolAction.value[pool.borrowable] === action ? null : action
  poolAmountInput.value[pool.borrowable] = ''
  poolTxStatus.value[pool.borrowable] = ''
}

function formatBN(bn: bigint, div: number): string {
  const decimals = Math.round(Math.log10(div))
  const s = bn.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, s.length - decimals)
  const frac = s.slice(s.length - decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}

function getMaxDepositAmount(pool: Pool): number {
  if (!data.value || !wallet.value) return 0
  const byAsset = data.value.idleBalancesByChainByAssetByUser?.[pool.chain]?.[pool.asset]?.[wallet.value]
  return byAsset?.amount ?? 0
}

function getMaxWithdrawBN(pool: Pool): bigint {
  if (!data.value || !wallet.value) return 0n
  const byBorrowable = data.value.suppliedByChainByBorrowableByUser?.[pool.chain]?.[pool.borrowable]?.[wallet.value]
  const deposited = byBorrowable?.bn ?? 0n
  const max = deposited < pool.cashBN ? deposited : pool.cashBN
  return (max * ONE) / pool.exchangeRate
}

function fillMax(pool: Pool) {
  const action = poolAction.value[pool.borrowable]
  if (!action) return
  if (action === 'deposit') {
    poolAmountInput.value[pool.borrowable] = String(getMaxDepositAmount(pool))
  } else {
    poolAmountInput.value[pool.borrowable] = formatBN(getMaxWithdrawBN(pool), getDiv(pool.asset))
  }
}

function parseBN(input: string, div: number): bigint {
  const decimals = Math.round(Math.log10(div))
  const [whole = '', frac = ''] = input.split('.')
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals))
}

function isAmountValid(pool: Pool): boolean {
  const action = poolAction.value[pool.borrowable]
  if (!action) return false
  const input = poolAmountInput.value[pool.borrowable]?.trim()
  if (!input || !/^\d+(\.\d+)?$/.test(input)) return false
  const div = getDiv(pool.asset)
  const inputBN = parseBN(input, div)
  if (inputBN <= 0n) return false
  if (action === 'deposit') return inputBN <= BigInt(Math.round(getMaxDepositAmount(pool) * div))
  return inputBN <= getMaxWithdrawBN(pool)
}

async function ensureCorrectChain(pool: Pool) {
  const ethereum = (window as any).ethereum
  if (!ethereum) throw new Error('No wallet detected')
  if (!wallet.value) {
    const [addr] = await ethereum.enable()
    wallet.value = getAddress(addr)
    walletChain.value = ethereum.chainId
  }
  if (chainIdByChain[pool.chain as Chains] !== walletChain.value) {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdByChain[pool.chain as Chains] }],
    })
    walletChain.value = ethereum.chainId
  }
}

async function handleDeposit(pool: Pool) {
  const b = pool.borrowable
  const isETH = pool.asset === ASSETS.ETH
  try {
    await ensureCorrectChain(pool)
    const div = getDiv(pool.asset)
    const amount = BigInt(Math.floor(Number(poolAmountInput.value[b]) * div))
    if (amount <= 0n) return
    const routerAddress = getRouterAddress(pool.chain)!
    const deadline = Math.floor(Date.now() / 1000) + 1200

    if (isETH) {
      poolTxStatus.value[b] = 'Depositing...'
      const calldata = encodeMintETH(pool.borrowable, wallet.value, deadline)
      const txHash = await sendTx({
        from: wallet.value,
        to: routerAddress,
        data: calldata,
        value: '0x' + amount.toString(16),
      })
      await waitForReceipt(txHash)
    } else {
      poolTxStatus.value[b] = 'Approving...'
      await ensureApproval(pool.underlying, wallet.value, routerAddress, amount)

      poolTxStatus.value[b] = 'Depositing...'
      const calldata = encodeMint(pool.borrowable, amount, wallet.value, deadline)
      const txHash = await sendTx({ from: wallet.value, to: routerAddress, data: calldata })
      await waitForReceipt(txHash)
    }

    poolTxStatus.value[b] = 'Success'
    poolAmountInput.value[b] = ''
  } catch (e: any) {
    poolTxStatus.value[b] = e?.message || 'Error'
  }
}

async function handleRedeem(pool: Pool) {
  const b = pool.borrowable
  const isETH = pool.asset === ASSETS.ETH
  try {
    await ensureCorrectChain(pool)
    const div = getDiv(pool.asset)
    const poolTokens = parseBN(poolAmountInput.value[b], div)
    if (poolTokens <= 0n) return
    const routerAddress = getRouterAddress(pool.chain)!
    const deadline = Math.floor(Date.now() / 1000) + 1200

    poolTxStatus.value[b] = 'Approving...'
    await ensureApproval(pool.borrowable, wallet.value, routerAddress, poolTokens)

    poolTxStatus.value[b] = 'Withdrawing...'
    const calldata = isETH
      ? encodeRedeemETH(pool.borrowable, poolTokens, wallet.value, deadline)
      : encodeRedeem(pool.borrowable, poolTokens, wallet.value, deadline)
    const txHash = await sendTx({ from: wallet.value, to: routerAddress, data: calldata })
    await waitForReceipt(txHash)

    poolTxStatus.value[b] = 'Success'
    poolAmountInput.value[b] = ''
  } catch (e: any) {
    poolTxStatus.value[b] = e?.message || 'Error'
  }
}
</script>

<template>
  <h1>{{ msg }}</h1>
  <Card>
    <template #content>
      <InputText v-model="addresses" class="w-full" placeholder="input addresses" size="large" />
    </template>
    <template #footer>
      <div>
        <div v-if="fetchingData" class="text-center">
          <ProgressSpinner
            style="width: 50px; height: 50px"
            strokeWidth="8"
            fill="transparent"
            animationDuration=".5s"
            aria-label="Custom ProgressSpinner"
          />
          <p class="m-0">Fetching: {{ pendingChains.join(', ') || 'finalizing...' }}</p>
        </div>
        <template v-else>
          <Button
            label="fetch data"
            class="w-full"
            :disabled="invalidAddresses(addresses) || fetchingData"
            @click="fetchData"
          ></Button>
        </template>
      </div>
    </template>
  </Card>

  <Panel
    header="Global stats"
    toggleable
    class="toggleable-area"
    :collapsed="collapsed.globals"
    @update:collapsed="
      (event) => {
        setCollapsed('globals', event)
      }
    "
  >
    <template v-if="data">
      <Card class="card-chain">
        <template #content>
          <StatWithBreakdown :showBreakdown="data.users.length > 1">
            Total deposited: {{ toUSDCurrency(data.totalDeposited) }}
            <template #breakdown>
              <div v-for="(usd, address) in data.suppliedByUser" :key="address" class="flex items-center gap-2">
                <div>
                  <span class="mono">{{ address }}</span
                  >: <span>{{ toUSDCurrency(usd) }}</span>
                </div>
              </div>
            </template>
          </StatWithBreakdown>
          <p class="m-0">
            Daily earnings: {{ toUSDCurrency(data.oldTotalEarnings) }} -> {{ toUSDCurrency(data.maxTotalEarnings) }}
          </p>
          <p class="m-0">APR: {{ data.currentAPR }}% -> {{ data.maxAPR }}%</p>
          <p class="m-0 text-positive" v-if="showRewards && data.morphoRewards">
            Morpho rewards: {{ data.morphoRewards.amount }} {{ data.morphoRewards.token }}/day ({{
              toUSDCurrency(data.morphoRewards.usd)
            }}) | APR: {{ data.morphoRewards.apr }}%
          </p>
          <p class="m-0 text-positive" v-if="showRewards && data.sparkRewards">
            Spark rewards: {{ data.sparkRewards.amount }} {{ data.sparkRewards.token }}/day ({{
              toUSDCurrency(data.sparkRewards.usd)
            }}) | APR: {{ data.sparkRewards.apr }}%
          </p>
          <StatWithBreakdown :showBreakdown="data.users.length > 1">
            Idle: {{ toUSDCurrency(data.usd) }}
            <template #breakdown>
              <div v-for="(usd, address) in data.idleBalancesByUser" :key="address" class="flex items-center gap-2">
                <div>
                  <span class="mono">{{ address }}</span
                  >: <span>{{ toUSDCurrency(usd) }}</span>
                </div>
              </div>
            </template>
          </StatWithBreakdown>
        </template>
      </Card>
    </template>
  </Panel>

  <Panel
    header="L&B positions"
    class="toggleable-area"
    toggleable
    :collapsed="collapsed.lending"
    @update:collapsed="
      (event) => {
        setCollapsed('lending', event)
      }
    "
  >
    <div class="card-grid">
      <template v-if="data" v-for="(chainProps, chain) in data.compoundBorrowingInfo" :key="chain">
        <template v-if="data" v-for="(marketProps, market) in chainProps" :key="market">
          <template v-if="data" v-for="(positionProps, user) in marketProps.positions" :key="user">
            <Card class="card-chain">
              <template #title>
                <Image :src="assetImgSrc(marketProps.asset)" :alt="marketProps.asset" width="50px" />
              </template>
              <template #subtitle> {{ user }} </template>
              <template #content>
                Supplied: {{ toUSDCurrency(positionProps.collateralTotalUsd) }}
                <template v-for="(collateralProps, collateral) in marketProps.collaterals" :key="collateral">
                  <template v-if="collateralProps[user] && collateralProps[user].bn > 0">
                    <div>
                      <span class="text-secondary"
                        >{{ collateralProps[user].amount }} {{ marketProps.collateralToAsset[collateral] }} ({{
                          toUSDCurrency(collateralProps[user].usd)
                        }})</span
                      >
                    </div>
                  </template>
                </template>

                <div>
                  Borrowed: {{ marketProps.borrowed[user].amount }} {{ marketProps.asset }} ({{
                    toUSDCurrency(marketProps.borrowed[user].usd)
                  }})
                </div>
                <div>
                  Daily borrowing cost: {{ marketProps.spendings[user].amount }} {{ marketProps.asset }} ({{
                    toUSDCurrency(marketProps.spendings[user].usd)
                  }})
                </div>
                <div>
                  Daily reward: {{ marketProps.rewards[user].amount }} {{ ASSETS.COMP }} ({{
                    toUSDCurrency(marketProps.rewards[user].usd)
                  }})
                </div>
                <div>Resulting APR: {{ positionProps.apr }}%</div>
                <div>Health factor: {{ positionProps.healthFactor }}</div>
                <div>
                  Liquidation price: {{ toUSDCurrency(positionProps.liquidationPrice) }} (current:
                  {{ toUSDCurrency(marketProps.assetPrice) }})
                </div>
              </template>
            </Card>
          </template>
        </template>
      </template>
      <template v-if="data" v-for="(positionProps, userChain) in data.aavePositions" :key="userChain">
        <Card class="card-chain">
          <template #title>
            <Image :src="platformImgSrc('AAVE')" alt="AAVE" width="50px" />
            <Image
              :src="chainImgSrc((userChain as unknown as string).substring(42))"
              :alt="(userChain as unknown as string).substring(42)"
              width="50px"
            />
          </template>
          <template #subtitle> {{ (userChain as unknown as string).substring(0, 42) }} </template>
          <template #content>
            Supplied: {{ toUSDCurrency(positionProps.collateralTotalUsd) }}
            <template v-for="(collateralProps, asset) in positionProps.collaterals" :key="asset">
              <template v-if="collateralProps.bn > 0">
                <div>
                  <span class="text-secondary"
                    >{{ collateralProps.amount }} {{ asset }} ({{ toUSDCurrency(collateralProps.usd) }})</span
                  >
                </div>
              </template>
            </template>

            <div>Borrowed: {{ toUSDCurrency(positionProps.borrowedTotalUsd) }}</div>
            <template v-for="(borrowProps, asset) in positionProps.borrows" :key="asset">
              <template v-if="borrowProps.bn > 0">
                <div>
                  <span class="text-secondary"
                    >{{ borrowProps.amount }} {{ asset }} ({{ toUSDCurrency(borrowProps.usd) }})</span
                  >
                </div>
              </template>
            </template>
            <div>Daily borrowing cost: {{ toUSDCurrency(positionProps.spendings) }}</div>
            <div>Daily earnings: {{ toUSDCurrency(positionProps.earnings) }}</div>
            <div>Resulting APR: {{ positionProps.apr }}%</div>
            <div>Health factor: {{ positionProps.healthFactor }}</div>

            <div class="flex justify-center items-center">
              <Button
                as="a"
                label="Go to AAVE"
                severity="secondary"
                outlined
                class="w-full"
                :href="
                  linkToPool({
                    vault: '',
                    platform: 'AAVE',
                    stable: false,
                    chain: (userChain as unknown as string).substring(42) as Chains,
                  })
                "
                target="_blank"
                rel="noopener"
              />
            </div>
          </template>
        </Card>
      </template>
    </div>
  </Panel>

  <Panel
    header="Liquidity by assets"
    class="toggleable-area"
    toggleable
    :collapsed="collapsed.assets"
    @update:collapsed="
      (event) => {
        setCollapsed('assets', event)
      }
    "
  >
    <div class="card-grid">
      <template v-if="data" v-for="(assetProps, asset) in data.cumulativeValuesByAsset" :key="asset">
        <Card class="card-chain">
          <template #title>
            <Image :src="assetImgSrc(asset)" :alt="asset" width="50px" />
          </template>
          <template #content>
            <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByAssetByUser[asset]">
              Supplied: {{ assetProps.newUserSupplied }} ({{ toUSDCurrency(assetProps.newUserSuppliedUsd) }})
              <template #breakdown>
                <div
                  v-for="({ amount, usd }, address) in data.suppliedByAssetByUser[asset]"
                  :key="address"
                  class="flex items-center gap-2"
                >
                  <div>
                    <span class="mono">{{ address }}</span
                    >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
            <p class="m-0">
              Daily earnings: {{ assetProps.oldDailyEarnings }} ({{ toUSDCurrency(assetProps.oldDailyEarningsUsd) }}) ->
              {{ assetProps.maxDailyEarnings }} ({{ toUSDCurrency(assetProps.maxDailyEarningsUsd) }})
              <span class="text-positive" v-if="showRewards && data.compoundBorrowingRewardByBorrowedAsset[asset]">
                +{{ data.compoundBorrowingRewardByBorrowedAsset[asset].amount }} {{ ASSETS.COMP }} ({{
                  toUSDCurrency(data.compoundBorrowingRewardByBorrowedAsset[asset].usd)
                }})</span
              >
              <span class="text-positive" v-if="showRewards && data.morphoRewardsByAsset[asset]">
                +{{ data.morphoRewardsByAsset[asset].amount }} {{ ASSETS.WLD }} ({{
                  toUSDCurrency(data.morphoRewardsByAsset[asset].usd)
                }})</span
              >
              <span class="text-positive" v-if="showRewards && data.sparkRewardsByAsset[asset]">
                +{{ data.sparkRewardsByAsset[asset].amount }} {{ ASSETS.AVAX }} ({{
                  toUSDCurrency(data.sparkRewardsByAsset[asset].usd)
                }})</span
              >
            </p>
            <p class="m-0">APR: {{ assetProps.currentAPR }}% -> {{ assetProps.maxAPR }}%</p>
            <StatWithBreakdown
              :showBreakdown="
                data.users.length > 1 &&
                !!data.idleBalancesByAssetByUser[asset] &&
                Object.keys(data.idleBalancesByAssetByUser[asset]).length > 0
              "
            >
              Idle: {{ data.idleBalancesByAsset[asset].amount }} ({{
                toUSDCurrency(data.idleBalancesByAsset[asset].usd)
              }})
              <template #breakdown>
                <div
                  v-for="({ amount, usd }, address) in data.idleBalancesByAssetByUser[asset]"
                  :key="address"
                  class="flex items-center gap-2"
                >
                  <div>
                    <span class="mono">{{ address }}</span
                    >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
          </template>
        </Card>
      </template>
    </div>
  </Panel>

  <Panel
    header="Liquidity by chains"
    class="toggleable-area"
    toggleable
    :collapsed="collapsed.chains"
    @update:collapsed="
      (event) => {
        setCollapsed('chains', event)
      }
    "
  >
    <div class="card-grid">
      <template v-if="data" v-for="(chainProps, chain) in data.cumulativeValuesByChains" :key="chain">
        <Card class="card-chain">
          <template #title>
            <Image :src="chainImgSrc(chain)" :alt="chain" width="50px" />
          </template>
          <template #content>
            <StatWithBreakdown :showBreakdown="data.users.length > 1 && !!data.suppliedByChainByUser[chain]">
              Total supplied: {{ toUSDCurrency(data.chainAggregatedStats[chain].newUserSuppliedUsd) }}
              <template #breakdown>
                <div
                  v-for="(usd, address) in data.suppliedByChainByUser[chain]"
                  :key="address"
                  class="flex items-center gap-2"
                >
                  <div>
                    <span class="mono">{{ address }}</span
                    >: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
            <p class="m-0">
              Daily earnings: {{ toUSDCurrency(data.chainAggregatedStats[chain].oldDailyEarningsUsd) }} ->
              {{ toUSDCurrency(data.chainAggregatedStats[chain].maxDailyEarningsUsd) }}
            </p>
            <p class="m-0">
              APR: {{ data.chainAggregatedStats[chain].currentAPR }}% -> {{ data.chainAggregatedStats[chain].maxAPR }}%
            </p>
            <p class="m-0 text-positive" v-if="showRewards && data.morphoRewardsByChain[chain]">
              Morpho rewards: +{{ data.morphoRewardsByChain[chain].amount }} {{ data.morphoRewards?.token }}/day ({{
                toUSDCurrency(data.morphoRewardsByChain[chain].usd)
              }})
            </p>
            <p class="m-0 text-positive" v-if="showRewards && data.sparkRewardsByChain[chain]">
              Spark rewards: +{{ data.sparkRewardsByChain[chain].amount }} {{ data.sparkRewards?.token }}/day ({{
                toUSDCurrency(data.sparkRewardsByChain[chain].usd)
              }})
            </p>
            <StatWithBreakdown :showBreakdown="data.users.length > 1">
              Idle: {{ toUSDCurrency(data.chainAggregatedStats[chain].usd) }}
              <template #breakdown>
                <div
                  v-for="(usd, address) in data.idleBalancesByChainByUser[chain]"
                  :key="address"
                  class="flex items-center gap-2"
                >
                  <div>
                    <span class="mono">{{ address }}</span
                    >: <span>{{ toUSDCurrency(usd) }}</span>
                  </div>
                </div>
              </template>
            </StatWithBreakdown>
            <Panel header="Assets" toggleable collapsed>
              <template v-for="(assetProps, asset) in chainProps" :key="asset">
                <Card class="card-asset">
                  <template #title>
                    <Image :src="assetImgSrc(asset)" :alt="asset" width="30px" />
                  </template>
                  <template #content>
                    <StatWithBreakdown
                      :showBreakdown="
                        data.users.length > 1 &&
                        !!data.suppliedByChainByAssetByUser[chain] &&
                        !!data.suppliedByChainByAssetByUser[chain][asset]
                      "
                    >
                      Supplied: {{ assetProps.newUserSupplied }} ({{ toUSDCurrency(assetProps.newUserSuppliedUsd) }})
                      <template #breakdown>
                        <div
                          v-for="({ amount, usd }, address) in data.suppliedByChainByAssetByUser[chain][asset]"
                          :key="address"
                          class="flex items-center gap-2"
                        >
                          <div>
                            <span class="mono">{{ address }}</span
                            >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                          </div>
                        </div>
                      </template>
                    </StatWithBreakdown>
                    <p class="m-0">
                      Daily earnings: {{ assetProps.oldDailyEarnings }} ({{
                        toUSDCurrency(assetProps.oldDailyEarningsUsd)
                      }}) -> {{ assetProps.maxDailyEarnings }} ({{ toUSDCurrency(assetProps.maxDailyEarningsUsd) }})
                      <span class="text-positive" v-if="showRewards && data.morphoRewardsByChainByAsset[chain]?.[asset]">
                        +{{ data.morphoRewardsByChainByAsset[chain][asset].amount }} {{ data.morphoRewards?.token }} ({{
                          toUSDCurrency(data.morphoRewardsByChainByAsset[chain][asset].usd)
                        }})</span
                      >
                      <span class="text-positive" v-if="showRewards && data.sparkRewardsByChainByAsset[chain]?.[asset]">
                        +{{ data.sparkRewardsByChainByAsset[chain][asset].amount }} {{ data.sparkRewards?.token }} ({{
                          toUSDCurrency(data.sparkRewardsByChainByAsset[chain][asset].usd)
                        }})</span
                      >
                    </p>
                    <p class="m-0">APR: {{ assetProps.currentAPR }}% -> {{ assetProps.maxAPR }}%</p>
                    <StatWithBreakdown
                      :showBreakdown="
                        data.users.length > 1 &&
                        !!data.idleBalancesByChainByAssetByUser[chain] &&
                        !!data.idleBalancesByChainByAssetByUser[chain][asset]
                      "
                    >
                      Idle: {{ data.idleBalancesByChain[chain]?.[asset]?.amount ?? 0 }} ({{
                        toUSDCurrency(data.idleBalancesByChain[chain]?.[asset]?.usd ?? 0)
                      }})
                      <template #breakdown>
                        <span class="font-medium block mb-2">Idle {{ asset }} balances on {{ chain }}</span>
                        <div
                          v-for="({ amount, usd }, address) in data.idleBalancesByChainByAssetByUser[chain][asset]"
                          :key="address"
                          class="flex items-center gap-2"
                        >
                          <div>
                            <span class="mono">{{ address }}</span
                            >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
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
      <div class="filter-bar">
        <div style="text-align: left">
          <div class="filter-label">
            <label>My deposits</label>
          </div>
          <ToggleSwitch v-model="onlyMyDeposits" />
        </div>
        <div>
          <div class="filter-label">
            <label>Select chains</label>
          </div>
          <div>
            <span v-for="chain in data.poolChains" :key="chain" @click="toggleChainSelected(chain)">
              <Image
                :src="chainImgSrc(chain)"
                :alt="chain"
                width="30px"
                class="filter-icon"
                :style="{ opacity: selectedChains[chain] ? 1 : 0.1 }"
              />
            </span>
          </div>
        </div>
        <div>
          <div class="filter-label">
            <label>Select assets</label>
          </div>
          <div>
            <span v-for="asset in data.poolAssets" :key="asset" @click="toggleAssetSelected(asset)">
              <Image
                :src="assetImgSrc(asset)"
                :alt="asset"
                width="30px"
                class="filter-icon"
                :style="{ opacity: selectedAssets[asset] ? 1 : 0.1 }"
              />
            </span>
          </div>
        </div>
      </div>
    </template>
    <template #content>
      <div class="card-grid">
        <template v-if="data" v-for="pool in data.goodPools" :key="pool.borrowable">
          <Card
            class="card-pool"
            v-if="selectedChains[pool.chain] && selectedAssets[pool.asset] && (!onlyMyDeposits || pool.suppliedBN > 0)"
          >
            <template #title
              >{{ pool.platform === 'AAVE' ? '' : 'Collateral:' }} {{ pool.asset }}{{ pool.oppositeSymbol ? '/' : ''
              }}{{ pool.oppositeSymbol }} ({{ pool.vaultAPR === '' ? pool.platform : pool.vaultAPR + '%' }})</template
            >
            <template #subtitle>
              <a target="_blank" rel="noopener" :href="linkToExplorer(pool)" class="mono">{{ pool.borrowable }}</a>
            </template>
            <template #content>
              <StatWithBreakdown
                :showBreakdown="
                  data.users.length > 1 &&
                  !!data.suppliedByChainByBorrowableByUser[pool.chain] &&
                  !!data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]
                "
              >
                Supplied: {{ pool.supplied }} ({{ toUSDCurrency(pool.suppliedUsd) }})
                <template #breakdown>
                  <div
                    v-for="({ amount, usd }, address) in data.suppliedByChainByBorrowableByUser[pool.chain][
                      pool.borrowable
                    ]"
                    :key="address"
                    class="flex items-center gap-2"
                  >
                    <div>
                      <span class="mono">{{ address }}</span
                      >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <p class="m-0">
                Daily earnings: {{ pool.earningsOld }} ({{ toUSDCurrency(pool.earningsOldUsd) }}) ->
                {{ pool.earningsNew }} ({{ toUSDCurrency(pool.earningsNewUsd) }})
                <span class="text-positive" v-if="showRewards && pool.stakingDailyEarnings">
                  +{{ pool.stakingDailyEarnings }} {{ pool.stakingRewardAsset }} ({{
                    toUSDCurrency(pool.stakingDailyEarningsUsd)
                  }})</span
                >
              </p>
              <p class="m-0">
                APR: {{ pool.aprOld }}% -> {{ pool.aprNew }}%
                <span class="text-positive" v-if="showRewards && pool.stakingAPR">
                  +{{ pool.stakingAPR }}% ({{ pool.stakingRewardAsset }})</span
                >
                <label
                  v-if="
                    ((data.cumulativeValuesByAsset[pool.asset] &&
                      data.cumulativeValuesByAsset[pool.asset].newUserSupplied > 0) ||
                      (data.idleBalancesByAsset[pool.asset] && data.idleBalancesByAsset[pool.asset].amount > 0)) &&
                    pool.aprNew + pool.stakingAPR > data.cumulativeValuesByAsset[pool.asset].maxAPR
                  "
                  >🔥</label
                >
              </p>
              <p class="m-0">Utilization: {{ pool.utilization }}% / {{ pool.kink }}%</p>
              <StatWithBreakdown
                :showBreakdown="
                  pool.availableToDepositUsd > 10 &&
                  !!data.idleBalancesByChain[pool.chain]?.[pool.asset] &&
                  data.idleBalancesByChain[pool.chain]?.[pool.asset]?.usd > 10
                "
              >
                Capacity: {{ pool.availableToDeposit }} ({{ toUSDCurrency(pool.availableToDepositUsd) }})
                <label v-if="pool.availableToDepositUsd > 1_000">👀</label>
                <template #breakdown>
                  <div
                    v-for="({ amount, usd }, address) in data.idleBalancesByChainByAssetByUser?.[pool.chain]?.[
                      pool.asset
                    ]"
                    :key="address"
                    class="flex items-center gap-2"
                  >
                    <div>
                      <span class="mono">{{ address }}</span
                      >: <span>{{ amount }} ({{ toUSDCurrency(usd) }})</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
              <p class="m-0">TVL: {{ pool.tvl }} ({{ toUSDCurrency(pool.tvlUsd) }})</p>
            </template>
            <template #footer>
              <div class="flex justify-center items-center">
                <Button
                  as="a"
                  label="Go to pool"
                  severity="secondary"
                  outlined
                  class="w-full"
                  :href="linkToPool(pool)"
                  target="_blank"
                  rel="noopener"
                />
                <Button
                  v-if="hasEthereum && pool.earningsNewUsd > pool.earningsOldUsd"
                  @click="handleSyncOrConnect(pool)"
                  :label="syncButtonLabel(pool)"
                  class="w-full"
                />
              </div>
              <template v-if="isImpermaxOrTarot(pool) && hasEthereum">
                <div class="flex gap-2" style="margin-top: 0.5rem">
                  <Button
                    size="small"
                    :severity="poolAction[pool.borrowable] === 'deposit' ? 'primary' : 'secondary'"
                    outlined
                    label="Deposit"
                    @click="togglePoolAction(pool, 'deposit')"
                  />
                  <Button
                    size="small"
                    :severity="poolAction[pool.borrowable] === 'withdraw' ? 'primary' : 'secondary'"
                    outlined
                    label="Withdraw"
                    @click="togglePoolAction(pool, 'withdraw')"
                  />
                </div>
                <template v-if="poolAction[pool.borrowable]">
                  <div class="pool-action-form">
                    <InputText
                      v-model="poolAmountInput[pool.borrowable]"
                      type="number"
                      :placeholder="pool.asset"
                      size="small"
                    />
                    <Button size="small" severity="secondary" label="Max" @click="fillMax(pool)" />
                  </div>
                  <Button
                    v-if="!wallet"
                    size="small"
                    class="w-full"
                    style="margin-top: 0.5rem"
                    label="Connect wallet"
                    @click="ensureCorrectChain(pool)"
                  />
                  <Button
                    v-else-if="walletChain !== chainIdByChain[pool.chain as Chains]"
                    size="small"
                    class="w-full"
                    style="margin-top: 0.5rem"
                    :label="'Switch to ' + pool.chain"
                    @click="ensureCorrectChain(pool)"
                  />
                  <Button
                    v-else
                    size="small"
                    class="w-full"
                    style="margin-top: 0.5rem"
                    :label="poolAction[pool.borrowable] === 'deposit' ? 'Confirm deposit' : 'Confirm withdraw'"
                    :disabled="!isAmountValid(pool)"
                    @click="poolAction[pool.borrowable] === 'deposit' ? handleDeposit(pool) : handleRedeem(pool)"
                  />
                  <div v-if="poolTxStatus[pool.borrowable]" class="pool-tx-status">
                    {{ poolTxStatus[pool.borrowable] }}
                  </div>
                </template>
              </template>
              <div class="flex items-center justify-between">
                <div>
                  <Image :src="chainImgSrc(pool.chain)" :alt="pool.chain" width="25px" />
                  <Image :src="platformImgSrc(pool.platform)" :alt="pool.platform" width="25px" />
                </div>
                <Image :src="assetImgSrc(pool.asset)" :alt="pool.asset" width="25px" />
              </div>
            </template>
          </Card>
        </template>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.toggleable-area {
  margin: 1rem;
}

.card-block {
  margin: 1rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
  padding: 0.5rem;
}

.card-pool,
.card-chain,
.card-asset {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition:
    box-shadow 0.25s ease,
    transform 0.25s ease;
}

.card-pool:hover,
.card-chain:hover,
.card-asset:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* Content vertical rhythm */
.card-pool :deep(.p-card-content) p,
.card-chain :deep(.p-card-content) p {
  margin: 0.4rem 0;
}

/* Truncate long addresses in card subtitles */
.card-pool :deep(.p-card-subtitle) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}

/* Button row gap */
.card-pool :deep(.p-card-footer) .flex {
  gap: 0.5rem;
}

/* Footer icon bar spacing */
.card-pool :deep(.p-card-footer) > .flex:last-child {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: flex-end;
}

.filter-label {
  margin-bottom: 0.4rem;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pool-action-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.pool-action-form input {
  flex: 1;
}
.pool-tx-status {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

@media (max-width: 640px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
  .filter-bar {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
