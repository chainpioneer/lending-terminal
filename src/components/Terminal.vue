<script setup lang="ts">
import { computed, onMounted, ref, type Ref } from 'vue'
import load from '../logic/load'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Panel from 'primevue/panel'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
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
import { toUSDCurrency, formatCompact, toUSDCompact, extractAddresses, invalidAddresses } from '../utils/formatting'
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
import PortfolioShare from './PortfolioShare.vue'

defineProps<{ msg: string }>()

const fetchingData = ref(false)
const fetchError = ref('')
const pendingChains = ref<string[]>([])
const addresses = ref(localStorage.getItem('userStr') || '')
const data: any = ref<Awaited<ReturnType<typeof load>>>()
const wallet = ref('')
const walletChain = ref('')
const activeTab = ref('portfolio')

const selectedChains = ref<{ [chain: string]: boolean }>({})
const selectedAssets = ref<{ [asset: string]: boolean }>({})
const selectedPlatforms = ref<{ [platform: string]: boolean }>({})

const onlyMyDeposits = ref(false)

const poolAction = ref<{ [borrowable: string]: 'deposit' | 'withdraw' | null }>({})
const poolAmountInput = ref<{ [borrowable: string]: string }>({})
const poolTxStatus = ref<{ [borrowable: string]: string }>({})

const hasEthereum = computed(() => !!(window as any).ethereum)

const visiblePools = computed<Pool[]>(() =>
  (data.value?.goodPools ?? []).filter(
    (pool: Pool) =>
      selectedChains.value[pool.chain] &&
      selectedAssets.value[pool.asset] &&
      selectedPlatforms.value[pool.platform] &&
      (!onlyMyDeposits.value || pool.suppliedBN > 0),
  ),
)

const hasLendingPositions = computed(
  () =>
    Object.keys(data.value?.aavePositions ?? {}).length > 0 ||
    Object.values(data.value?.compoundBorrowingInfo ?? {}).some((markets: any) =>
      Object.values(markets).some((market: any) => Object.keys(market.positions ?? {}).length > 0),
    ),
)

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

const togglePlatformSelected = (platform: string) =>
  toggleFilterSelection(platform, selectedPlatforms, data.value.poolPlatforms)

async function fetchData() {
  fetchingData.value = true
  data.value = undefined
  const allChains = Object.keys(CHAIN_CONF)
  pendingChains.value = [...allChains]
  const userAddresses = addresses.value
  fetchError.value = ''
  try {
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
    selectedPlatforms.value = {}
    data.value.poolPlatforms.forEach((platform: string) => {
      selectedPlatforms.value[platform] = true
    })
    activeTab.value = 'portfolio'
  } catch {
    fetchError.value = 'Could not load all networks. Please try again.'
  } finally {
    fetchingData.value = false
  }
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
    await sendTx({ from: wallet.value, to: pool.borrowable, data: '0xfff6cae9' })
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
  <header class="page-header">
    <h1>{{ msg }}</h1>
    <p class="mb-2">Your wallets. Your lending positions. One portfolio APR.</p>
    <small class="text-secondary">A personal DeFi yield aggregator. Built in public, supported for nobody.</small>
  </header>

  <Card class="address-card">
    <template #content>
      <div class="address-row">
        <div class="address-input-wrapper">
          <InputText
            v-model="addresses"
            class="address-input"
            placeholder="Enter wallet addresses (comma-separated)"
            aria-label="Wallet addresses"
            size="large"
            @keydown.enter="!invalidAddresses(addresses) && !fetchingData && fetchData()"
          />
          <button
            v-if="!addresses"
            type="button"
            class="example-link"
            @click="addresses = '0xC72AED14386158960D0E93Fecb83642e68482E4b'"
          >
            try example address
          </button>
        </div>
        <Button
          label="Calculate portfolio APR"
          size="large"
          class="fetch-button"
          :loading="fetchingData"
          :disabled="invalidAddresses(addresses) || fetchingData"
          @click="fetchData"
        />
      </div>
      <p v-if="fetchError" role="alert">{{ fetchError }}</p>
      <p v-if="fetchingData" class="fetch-status">Fetching: {{ pendingChains.join(', ') || 'finalizing...' }}</p>
      <p class="text-secondary">
        Paste EVM addresses and fetch. No wallet connection needed. Only configured markets are tracked.
        <a
          href="https://github.com/chainpioneer/lending-terminal#supported-protocols-and-networks"
          target="_blank"
          rel="noopener"
          >Check coverage</a
        >
        ·
        <a href="https://github.com/chainpioneer/lending-terminal/issues/new/choose" target="_blank" rel="noopener"
          >Wrong data or missing protocol?</a
        >
      </p>
    </template>
  </Card>

  <Tabs v-model:value="activeTab" class="portfolio-tabs">
    <TabList aria-label="Portfolio modules">
      <Tab value="portfolio">Portfolio APR</Tab>
      <Tab value="positions" :disabled="!data">Positions</Tab>
      <Tab value="assets" :disabled="!data">Assets</Tab>
      <Tab value="networks" :disabled="!data">Networks</Tab>
      <Tab value="markets" :disabled="!data">Markets</Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="portfolio">
        <section class="apr-hero" aria-labelledby="portfolio-apr-title">
          <div>
            <span class="eyebrow">THE YIELD OF YOUR PORTFOLIO</span>
            <h2 id="portfolio-apr-title">Aggregate portfolio APR</h2>
            <div class="apr-number" :class="{ negative: data && Number(data.currentAPR) < 0 }">
              {{ data && Number(data.totalDeposited) > 0 ? data.currentAPR : '—'
              }}<span v-if="data && Number(data.totalDeposited) > 0">%</span>
            </div>
            <p v-if="!data">Add your wallets to see what your lending portfolio earns as a whole.</p>
            <p v-else-if="Number(data.totalDeposited) <= 0">
              No positive net supplied capital found in the tracked positions.
            </p>
            <p v-else>
              {{ data.users.length }} {{ data.users.length === 1 ? 'wallet' : 'wallets' }} · Supply earnings + rewards −
              supported borrowing costs
            </p>
          </div>
          <div class="apr-method">
            <h3>One rate, across your positions.</h3>
            <p>Annualized net daily earnings ÷ net supplied capital. Weighted by value, not an average of pool APRs.</p>
            <p class="text-secondary">
              Idle funds are excluded. Includes estimated COMP, Morpho and Spark rewards when available. Coverage is
              limited to configured integrations; unavailable incentives are not included.
            </p>
            <a
              href="https://github.com/chainpioneer/lending-terminal#what-the-apr-numbers-mean"
              target="_blank"
              rel="noopener"
              >How the numbers are calculated ↗</a
            >
          </div>
        </section>
        <template v-if="data">
          <div class="portfolio-composition">
            <div class="composition-counts">
              <span v-for="(count, label) in data.portfolioSummary" :key="label"
                ><strong>{{ count }}</strong> {{ label }}</span
              >
            </div>
            <PortfolioShare
              :apr="Number(data.totalDeposited) > 0 ? data.currentAPR + '%' : 'N/A'"
              :summary="data.portfolioSummary"
              :fetched-at="data.fetchedAt"
            />
          </div>
          <p class="text-secondary composition-note">
            Tracked positions only. Each market + asset counts once across wallets; supply and debt are combined. Idle
            balances excluded.
          </p>
          <div class="kpi-grid">
            <div class="kpi">
              <span class="kpi-label">Net supplied capital</span>
              <StatWithBreakdown :showBreakdown="data.users.length > 1">
                {{ toUSDCurrency(data.totalDeposited) }}
                <template #breakdown>
                  <div v-for="(usd, address) in data.suppliedByUser" :key="address" class="flex items-center gap-2">
                    <div>
                      <span class="mono">{{ address }}</span
                      >: <span>{{ toUSDCurrency(usd) }}</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
            </div>
            <div class="kpi">
              <span class="kpi-label">Daily earnings</span>
              <StatWithBreakdown>
                {{ toUSDCurrency(data.oldTotalEarnings) }}
              </StatWithBreakdown>
            </div>
            <div class="kpi">
              <span class="kpi-label">After simulated updates</span>
              <StatWithBreakdown>{{ Number(data.totalDeposited) > 0 ? data.maxAPR + '%' : '—' }}</StatWithBreakdown>
              <small class="text-secondary">Same positions, after sync/reinvest</small>
            </div>
            <div class="kpi">
              <span class="kpi-label">Idle</span>
              <StatWithBreakdown :showBreakdown="data.users.length > 1">
                {{ toUSDCurrency(data.usd) }}
                <template #breakdown>
                  <div v-for="(usd, address) in data.idleBalancesByUser" :key="address" class="flex items-center gap-2">
                    <div>
                      <span class="mono">{{ address }}</span
                      >: <span>{{ toUSDCurrency(usd) }}</span>
                    </div>
                  </div>
                </template>
              </StatWithBreakdown>
            </div>
          </div>
          <p class="rewards text-positive" v-if="data.morphoRewards?.usd > 0">
            Included Morpho rewards: {{ data.morphoRewards.amount }} {{ data.morphoRewards.token }}/day ({{
              toUSDCurrency(data.morphoRewards.usd)
            }}) · APR contribution {{ data.morphoRewards.apr == null ? '—' : data.morphoRewards.apr + '%' }}
          </p>
          <p class="rewards text-positive" v-if="data.sparkRewards?.usd > 0">
            Included Spark rewards: {{ data.sparkRewards.amount }} {{ data.sparkRewards.token }}/day ({{
              toUSDCurrency(data.sparkRewards.usd)
            }}) · APR contribution {{ data.sparkRewards.apr == null ? '—' : data.sparkRewards.apr + '%' }}
          </p>
        </template>
      </TabPanel>

      <TabPanel v-if="data" value="positions">
        <p v-if="!hasLendingPositions" class="empty">
          No Aave or Compound positions found. Vault and pool deposits are available in Markets.
        </p>
        <div class="card-grid">
          <template v-for="(chainProps, chain) in data.compoundBorrowingInfo" :key="chain">
            <template v-for="(marketProps, market) in chainProps" :key="market">
              <Card v-for="(positionProps, user) in marketProps.positions" :key="user" class="card-stat">
                <template #title>
                  <div class="card-head">
                    <img :src="assetImgSrc(marketProps.asset)" :alt="marketProps.asset" class="icon" />
                    <span>{{ marketProps.asset }}</span>
                  </div>
                </template>
                <template #subtitle>
                  <span class="mono">{{ user }}</span>
                </template>
                <template #content>
                  <StatWithBreakdown label="Supplied">{{
                    toUSDCurrency(positionProps.collateralTotalUsd)
                  }}</StatWithBreakdown>
                  <template v-for="(collateralProps, collateral) in marketProps.collaterals" :key="collateral">
                    <p v-if="collateralProps[user] && collateralProps[user].bn > 0" class="stat-sub">
                      {{ collateralProps[user].amount }} {{ marketProps.collateralToAsset[collateral] }} ({{
                        toUSDCurrency(collateralProps[user].usd)
                      }})
                    </p>
                  </template>
                  <StatWithBreakdown label="Borrowed">
                    {{ marketProps.borrowed[user].amount }} {{ marketProps.asset }} ({{
                      toUSDCurrency(marketProps.borrowed[user].usd)
                    }})
                  </StatWithBreakdown>
                  <StatWithBreakdown label="Daily borrowing cost">
                    {{ marketProps.spendings[user].amount }} {{ marketProps.asset }} ({{
                      toUSDCurrency(marketProps.spendings[user].usd)
                    }})
                  </StatWithBreakdown>
                  <StatWithBreakdown label="Daily reward">
                    {{ marketProps.rewards[user].amount }} {{ ASSETS.COMP }} ({{
                      toUSDCurrency(marketProps.rewards[user].usd)
                    }})
                  </StatWithBreakdown>
                  <StatWithBreakdown label="Resulting APR">{{ positionProps.apr }}%</StatWithBreakdown>
                  <StatWithBreakdown label="Health factor">{{ positionProps.healthFactor }}</StatWithBreakdown>
                  <StatWithBreakdown label="Liquidation price">
                    {{ toUSDCurrency(positionProps.liquidationPrice) }} (now
                    {{ toUSDCurrency(marketProps.assetPrice) }})
                  </StatWithBreakdown>
                </template>
              </Card>
            </template>
          </template>
          <Card v-for="(positionProps, userChain) in data.aavePositions" :key="userChain" class="card-stat">
            <template #title>
              <div class="card-head">
                <img :src="platformImgSrc('AAVE')" alt="AAVE" class="icon" />
                <img
                  :src="chainImgSrc(String(userChain).substring(42))"
                  :alt="String(userChain).substring(42)"
                  class="icon"
                />
                <span>AAVE · {{ String(userChain).substring(42) }}</span>
              </div>
            </template>
            <template #subtitle>
              <span class="mono">{{ String(userChain).substring(0, 42) }}</span>
            </template>
            <template #content>
              <StatWithBreakdown label="Supplied">{{
                toUSDCurrency(positionProps.collateralTotalUsd)
              }}</StatWithBreakdown>
              <template v-for="(collateralProps, asset) in positionProps.collaterals" :key="asset">
                <p v-if="collateralProps.bn > 0" class="stat-sub">
                  {{ collateralProps.amount }} {{ asset }} ({{ toUSDCurrency(collateralProps.usd) }})
                </p>
              </template>
              <StatWithBreakdown label="Borrowed">{{
                toUSDCurrency(positionProps.borrowedTotalUsd)
              }}</StatWithBreakdown>
              <template v-for="(borrowProps, asset) in positionProps.borrows" :key="asset">
                <p v-if="borrowProps.bn > 0" class="stat-sub">
                  {{ borrowProps.amount }} {{ asset }} ({{ toUSDCurrency(borrowProps.usd) }})
                </p>
              </template>
              <StatWithBreakdown label="Daily borrowing cost">{{
                toUSDCurrency(positionProps.spendings)
              }}</StatWithBreakdown>
              <StatWithBreakdown label="Daily earnings">{{ toUSDCurrency(positionProps.earnings) }}</StatWithBreakdown>
              <StatWithBreakdown label="Resulting APR">{{ positionProps.apr }}%</StatWithBreakdown>
              <StatWithBreakdown label="Health factor">{{ positionProps.healthFactor }}</StatWithBreakdown>
            </template>
            <template #footer>
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
                    chain: String(userChain).substring(42) as Chains,
                  })
                "
                target="_blank"
                rel="noopener"
              />
            </template>
          </Card>
        </div>
      </TabPanel>

      <TabPanel v-if="data" value="assets">
        <div class="card-grid">
          <Card v-for="(assetProps, asset) in data.cumulativeValuesByAsset" :key="asset" class="card-stat">
            <template #title>
              <div class="card-head">
                <img :src="assetImgSrc(asset)" :alt="String(asset)" class="icon" />
                <span>{{ asset }}</span>
              </div>
            </template>
            <template #content>
              <StatWithBreakdown
                label="Supplied"
                :showBreakdown="data.users.length > 1 && !!data.suppliedByAssetByUser[asset]"
              >
                {{ assetProps.newUserSupplied }} ({{ toUSDCurrency(assetProps.newUserSuppliedUsd) }})
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
              <StatWithBreakdown label="Daily earnings">
                {{ assetProps.oldDailyEarnings }} ({{ toUSDCurrency(assetProps.oldDailyEarningsUsd) }}) →
                {{ assetProps.maxDailyEarnings }} ({{ toUSDCurrency(assetProps.maxDailyEarningsUsd) }})
                <span class="text-positive" v-if="data.compoundBorrowingRewardByBorrowedAsset[asset]?.usd > 0">
                  +{{ data.compoundBorrowingRewardByBorrowedAsset[asset].amount }} {{ ASSETS.COMP }} ({{
                    toUSDCurrency(data.compoundBorrowingRewardByBorrowedAsset[asset].usd)
                  }})</span
                >
                <span class="text-positive" v-if="data.morphoRewardsByAsset[asset]?.usd > 0">
                  +{{ data.morphoRewardsByAsset[asset].amount }} {{ ASSETS.WLD }} ({{
                    toUSDCurrency(data.morphoRewardsByAsset[asset].usd)
                  }})</span
                >
                <span class="text-positive" v-if="data.sparkRewardsByAsset[asset]?.usd > 0">
                  +{{ data.sparkRewardsByAsset[asset].amount }} {{ ASSETS.AVAX }} ({{
                    toUSDCurrency(data.sparkRewardsByAsset[asset].usd)
                  }})</span
                >
              </StatWithBreakdown>
              <StatWithBreakdown label="APR">{{ assetProps.currentAPR }}% → {{ assetProps.maxAPR }}%</StatWithBreakdown>
              <StatWithBreakdown
                label="Idle"
                :showBreakdown="
                  data.users.length > 1 &&
                  !!data.idleBalancesByAssetByUser[asset] &&
                  Object.keys(data.idleBalancesByAssetByUser[asset]).length > 0
                "
              >
                {{ data.idleBalancesByAsset[asset]?.amount ?? 0 }} ({{
                  toUSDCurrency(data.idleBalancesByAsset[asset]?.usd ?? 0)
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
        </div>
      </TabPanel>

      <TabPanel v-if="data" value="networks">
        <div class="card-grid">
          <Card v-for="(chainProps, chain) in data.cumulativeValuesByChains" :key="chain" class="card-stat">
            <template #title>
              <div class="card-head">
                <img :src="chainImgSrc(chain)" :alt="String(chain)" class="icon" />
                <span>{{ chain }}</span>
              </div>
            </template>
            <template #content>
              <StatWithBreakdown
                label="Total supplied"
                :showBreakdown="data.users.length > 1 && !!data.suppliedByChainByUser[chain]"
              >
                {{ toUSDCurrency(data.chainAggregatedStats[chain].newUserSuppliedUsd) }}
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
              <StatWithBreakdown label="Daily earnings">
                {{ toUSDCurrency(data.chainAggregatedStats[chain].oldDailyEarningsUsd) }} →
                {{ toUSDCurrency(data.chainAggregatedStats[chain].maxDailyEarningsUsd) }}
              </StatWithBreakdown>
              <StatWithBreakdown label="APR">
                {{ data.chainAggregatedStats[chain].currentAPR }}% → {{ data.chainAggregatedStats[chain].maxAPR }}%
              </StatWithBreakdown>
              <StatWithBreakdown v-if="data.morphoRewardsByChain[chain]?.usd > 0" label="Morpho rewards">
                <span class="text-positive">
                  +{{ data.morphoRewardsByChain[chain].amount }} {{ data.morphoRewards?.token }}/day ({{
                    toUSDCurrency(data.morphoRewardsByChain[chain].usd)
                  }})
                </span>
              </StatWithBreakdown>
              <StatWithBreakdown v-if="data.sparkRewardsByChain[chain]?.usd > 0" label="Spark rewards">
                <span class="text-positive">
                  +{{ data.sparkRewardsByChain[chain].amount }} {{ data.sparkRewards?.token }}/day ({{
                    toUSDCurrency(data.sparkRewardsByChain[chain].usd)
                  }})
                </span>
              </StatWithBreakdown>
              <StatWithBreakdown label="Idle" :showBreakdown="data.users.length > 1">
                {{ toUSDCurrency(data.chainAggregatedStats[chain].usd) }}
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
              <Panel header="Assets" toggleable collapsed class="sub-panel">
                <div v-for="(assetProps, asset) in chainProps" :key="asset" class="sub-asset">
                  <div class="card-head small">
                    <img :src="assetImgSrc(asset)" :alt="String(asset)" class="icon" />
                    <span>{{ asset }}</span>
                  </div>
                  <StatWithBreakdown
                    label="Supplied"
                    :showBreakdown="
                      data.users.length > 1 &&
                      !!data.suppliedByChainByAssetByUser[chain] &&
                      !!data.suppliedByChainByAssetByUser[chain][asset]
                    "
                  >
                    {{ assetProps.newUserSupplied }} ({{ toUSDCurrency(assetProps.newUserSuppliedUsd) }})
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
                  <StatWithBreakdown label="Daily earnings">
                    {{ assetProps.oldDailyEarnings }} ({{ toUSDCurrency(assetProps.oldDailyEarningsUsd) }}) →
                    {{ assetProps.maxDailyEarnings }} ({{ toUSDCurrency(assetProps.maxDailyEarningsUsd) }})
                    <span class="text-positive" v-if="data.morphoRewardsByChainByAsset[chain]?.[asset]?.usd > 0">
                      +{{ data.morphoRewardsByChainByAsset[chain][asset].amount }} {{ data.morphoRewards?.token }} ({{
                        toUSDCurrency(data.morphoRewardsByChainByAsset[chain][asset].usd)
                      }})</span
                    >
                    <span class="text-positive" v-if="data.sparkRewardsByChainByAsset[chain]?.[asset]?.usd > 0">
                      +{{ data.sparkRewardsByChainByAsset[chain][asset].amount }} {{ data.sparkRewards?.token }} ({{
                        toUSDCurrency(data.sparkRewardsByChainByAsset[chain][asset].usd)
                      }})</span
                    >
                  </StatWithBreakdown>
                  <StatWithBreakdown label="APR">
                    {{ assetProps.currentAPR }}% → {{ assetProps.maxAPR }}%
                  </StatWithBreakdown>
                  <StatWithBreakdown
                    label="Idle"
                    :showBreakdown="
                      data.users.length > 1 &&
                      !!data.idleBalancesByChainByAssetByUser[chain] &&
                      !!data.idleBalancesByChainByAssetByUser[chain][asset]
                    "
                  >
                    {{ data.idleBalancesByChain[chain]?.[asset]?.amount ?? 0 }} ({{
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
                </div>
              </Panel>
            </template>
          </Card>
        </div>
      </TabPanel>

      <TabPanel v-if="data" value="markets">
        <section class="pools">
          <div class="toolbar">
            <label class="toolbar-group">
              <span class="toolbar-label">My deposits</span>
              <ToggleSwitch v-model="onlyMyDeposits" />
            </label>
            <div class="toolbar-group">
              <span class="toolbar-label">Chains</span>
              <div class="chips">
                <button
                  v-for="chain in data.poolChains"
                  :key="chain"
                  type="button"
                  class="chip"
                  :class="{ off: !selectedChains[chain] }"
                  :aria-pressed="!!selectedChains[chain]"
                  :title="chain"
                  @click="toggleChainSelected(chain)"
                >
                  <img :src="chainImgSrc(chain)" :alt="chain" />
                </button>
              </div>
            </div>
            <div class="toolbar-group">
              <span class="toolbar-label">Assets</span>
              <div class="chips">
                <button
                  v-for="asset in data.poolAssets"
                  :key="asset"
                  type="button"
                  class="chip"
                  :class="{ off: !selectedAssets[asset] }"
                  :aria-pressed="!!selectedAssets[asset]"
                  :title="asset"
                  @click="toggleAssetSelected(asset)"
                >
                  <img :src="assetImgSrc(asset)" :alt="asset" />
                </button>
              </div>
            </div>
            <div class="toolbar-group">
              <span class="toolbar-label">Protocols</span>
              <div class="chips">
                <button
                  v-for="platform in data.poolPlatforms"
                  :key="platform"
                  type="button"
                  class="chip"
                  :class="{ off: !selectedPlatforms[platform] }"
                  :aria-pressed="!!selectedPlatforms[platform]"
                  :title="platform"
                  @click="togglePlatformSelected(platform)"
                >
                  <img :src="platformImgSrc(platform)" :alt="platform" />
                </button>
              </div>
            </div>
            <span class="toolbar-count"
              >{{ visiblePools.length }} {{ visiblePools.length === 1 ? 'pool' : 'pools' }}</span
            >
          </div>

          <div class="card-grid">
            <Card v-for="pool in visiblePools" :key="pool.borrowable" class="card-pool">
              <template #title>
                <div class="pool-head">
                  <div class="pool-icons">
                    <img :src="chainImgSrc(pool.chain)" :alt="pool.chain" :title="pool.chain" />
                    <img :src="platformImgSrc(pool.platform)" :alt="pool.platform" :title="pool.platform" />
                    <img :src="assetImgSrc(pool.asset)" :alt="pool.asset" :title="pool.asset" />
                  </div>
                  <span class="pool-tag">{{ pool.vaultAPR === '' ? pool.platform : pool.vaultAPR + '%' }}</span>
                </div>
                <div class="pool-name">
                  <span v-if="!['AAVE', 'MORPHO', 'SPARK', 'REVERT', 'EXTRA'].includes(pool.platform)" class="pool-kind"
                    >Collateral</span
                  >
                  {{ pool.asset }}{{ pool.oppositeSymbol ? '/' : '' }}{{ pool.oppositeSymbol }}
                </div>
              </template>
              <template #subtitle>
                <a target="_blank" rel="noopener" :href="linkToExplorer(pool)" class="mono">{{ pool.borrowable }}</a>
              </template>
              <template #content>
                <div class="pool-apr">
                  <span class="pool-apr-value">{{ pool.aprOld }}% → {{ pool.aprNew }}%</span>
                  <span
                    v-if="
                      data.cumulativeValuesByAsset[pool.asset] &&
                      (data.cumulativeValuesByAsset[pool.asset].newUserSupplied > 0 ||
                        data.idleBalancesByAsset[pool.asset]?.amount > 0) &&
                      pool.aprNew + pool.stakingAPR > data.cumulativeValuesByAsset[pool.asset].maxAPR
                    "
                    title="Better than your current APR for this asset"
                    >🔥</span
                  >
                  <span class="text-positive" v-if="pool.stakingAPR > 0"
                    >+{{ pool.stakingAPR }}% ({{ pool.stakingRewardAsset }})</span
                  >
                </div>
                <StatWithBreakdown
                  label="Supplied"
                  :showBreakdown="
                    data.users.length > 1 &&
                    !!data.suppliedByChainByBorrowableByUser[pool.chain] &&
                    !!data.suppliedByChainByBorrowableByUser[pool.chain][pool.borrowable]
                  "
                >
                  {{ pool.supplied }} ({{ toUSDCurrency(pool.suppliedUsd) }})
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
                <StatWithBreakdown label="Daily earnings">
                  {{ pool.earningsOld }} ({{ toUSDCurrency(pool.earningsOldUsd) }}) → {{ pool.earningsNew }} ({{
                    toUSDCurrency(pool.earningsNewUsd)
                  }})
                  <span class="text-positive" v-if="pool.stakingDailyEarnings > 0">
                    +{{ pool.stakingDailyEarnings }} {{ pool.stakingRewardAsset }} ({{
                      toUSDCurrency(pool.stakingDailyEarningsUsd)
                    }})</span
                  >
                </StatWithBreakdown>
                <StatWithBreakdown label="Utilization">{{ pool.utilization }}% / {{ pool.kink }}%</StatWithBreakdown>
                <div class="util-bar" aria-hidden="true">
                  <span
                    :class="{ over: pool.utilization > pool.kink }"
                    :style="{ width: Math.min(pool.utilization, 100) + '%' }"
                  />
                  <i :style="{ left: Math.min(pool.kink, 100) + '%' }" />
                </div>
                <StatWithBreakdown
                  v-if="pool.availableToDeposit > 0"
                  label="Capacity"
                  :showBreakdown="
                    pool.availableToDepositUsd > 10 &&
                    !!data.idleBalancesByChain[pool.chain]?.[pool.asset] &&
                    data.idleBalancesByChain[pool.chain]?.[pool.asset]?.usd > 10
                  "
                >
                  {{ formatCompact(pool.availableToDeposit) }} ({{ toUSDCompact(pool.availableToDepositUsd) }})
                  <span v-if="pool.availableToDepositUsd > 1_000">👀</span>
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
                <StatWithBreakdown label="TVL"
                  >{{ formatCompact(pool.tvl) }} ({{ toUSDCompact(pool.tvlUsd) }})</StatWithBreakdown
                >
              </template>
              <template #footer>
                <div class="pool-actions">
                  <Button
                    as="a"
                    label="Go to pool"
                    severity="secondary"
                    outlined
                    :href="linkToPool(pool)"
                    target="_blank"
                    rel="noopener"
                  />
                  <Button
                    v-if="hasEthereum && pool.earningsNewUsd > pool.earningsOldUsd"
                    @click="handleSyncOrConnect(pool)"
                    :label="syncButtonLabel(pool)"
                  />
                </div>
                <template v-if="isImpermaxOrTarot(pool) && hasEthereum">
                  <div class="pool-actions">
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
                      label="Connect wallet"
                      @click="ensureCorrectChain(pool)"
                    />
                    <Button
                      v-else-if="walletChain !== chainIdByChain[pool.chain as Chains]"
                      size="small"
                      class="w-full"
                      :label="'Switch to ' + pool.chain"
                      @click="ensureCorrectChain(pool)"
                    />
                    <Button
                      v-else
                      size="small"
                      class="w-full"
                      :label="poolAction[pool.borrowable] === 'deposit' ? 'Confirm deposit' : 'Confirm withdraw'"
                      :disabled="!isAmountValid(pool)"
                      @click="poolAction[pool.borrowable] === 'deposit' ? handleDeposit(pool) : handleRedeem(pool)"
                    />
                    <div v-if="poolTxStatus[pool.borrowable]" class="pool-tx-status">
                      {{ poolTxStatus[pool.borrowable] }}
                    </div>
                  </template>
                </template>
              </template>
            </Card>
          </div>
          <p v-if="!visiblePools.length" class="empty">No pools match the filters</p>
        </section>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<style scoped>
.portfolio-composition,
.composition-counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
}
.portfolio-composition {
  justify-content: space-between;
}
.composition-counts strong {
  font-size: 1.5rem;
}
.composition-note {
  font-size: 0.8rem;
  margin-bottom: 1.25rem;
}
.portfolio-tabs {
  margin-top: 1.5rem;
}
.portfolio-tabs :deep(.p-tablist-tab-list) {
  overflow-x: auto;
  flex-wrap: nowrap;
}
.portfolio-tabs :deep(.p-tab) {
  white-space: nowrap;
}
.portfolio-tabs :deep(.p-tabpanels) {
  padding: 1.5rem 0;
  background: transparent;
}
.apr-hero {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 2rem;
  padding: clamp(1.5rem, 4vw, 3rem);
  margin-bottom: 1.25rem;
  border: 1px solid var(--p-primary-200);
  border-radius: 16px;
  background: color-mix(in srgb, var(--p-primary-color) 7%, var(--p-content-background));
}
.eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--p-text-muted-color);
}
.apr-hero h2 {
  font-size: 1.15rem;
  font-weight: 500;
  margin: 0.75rem 0 0;
}
.apr-number {
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1.15;
  font-weight: 650;
  letter-spacing: -0.06em;
  color: var(--positive);
}
.apr-number span {
  font-size: 0.5em;
  padding-left: 0.15em;
}
.apr-number.negative {
  color: var(--p-red-500);
}
.apr-method {
  align-self: center;
  max-width: 32rem;
}
.apr-method h3 {
  font-size: 1.1rem;
}
.apr-method p {
  font-size: 0.9rem;
}
@media (max-width: 700px) {
  .apr-hero {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}

.page-header {
  margin-bottom: 1.25rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* === Address input === */
.address-card,
.card-stat,
.card-pool {
  border: 1px solid var(--p-content-border-color);
  box-shadow: none;
}

.address-card {
  margin-bottom: 1rem;
}

.address-row {
  display: flex;
  gap: 0.75rem;
}

.address-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.address-input {
  width: 100%;
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.address-input-wrapper:has(.example-link) .address-input {
  padding-right: 11rem;
}

.example-link {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.example-link:hover {
  background: var(--p-primary-50, rgba(16, 185, 129, 0.08));
}

.fetch-button {
  flex-shrink: 0;
}

.fetch-status {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

/* === Sections === */
.section {
  margin-bottom: 1rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  gap: 0.75rem;
}

.kpi {
  padding: 0.875rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
}

.kpi-label,
.toolbar-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.kpi :deep(.stat) {
  padding: 0.25rem 0 0;
}

.kpi :deep(.stat-value) {
  font-size: 1.25rem;
  font-weight: 600;
  text-align: left;
}

.rewards {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 1rem;
}

.card-grid > * {
  min-width: 0;
}

/* === Cards === */
.card-stat,
.card-pool {
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.card-stat:hover,
.card-pool:hover {
  border-color: color-mix(in srgb, var(--p-primary-color) 45%, var(--p-content-border-color));
  box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.25);
}

.card-stat :deep(.p-card-body),
.card-pool :deep(.p-card-body) {
  flex: 1;
}

.card-stat :deep(.p-card-content),
.card-pool :deep(.p-card-content) {
  flex: 1;
}

.card-stat :deep(.p-card-subtitle),
.card-pool :deep(.p-card-subtitle) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.card-pool :deep(.p-card-subtitle) a {
  color: inherit;
}

.card-pool :deep(.p-card-subtitle) a:hover {
  color: var(--p-primary-color);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: contain;
  flex-shrink: 0;
}

.card-head.small {
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.card-head.small .icon {
  width: 22px;
  height: 22px;
}

.stat-sub {
  margin: 0 0 0.25rem;
  text-align: right;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
}

.sub-panel {
  margin-top: 0.75rem;
}

.sub-asset + .sub-asset {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--p-content-border-color);
}

/* === Pools toolbar === */
.pools {
  margin-top: 1.5rem;
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  background: color-mix(in srgb, var(--p-content-background) 85%, transparent);
  backdrop-filter: blur(10px);
}

.toolbar-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.chip {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    filter 0.15s ease,
    transform 0.15s ease;
}

.chip img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: contain;
}

.chip:hover {
  transform: scale(1.1);
}

.chip:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 1px;
}

.chip.off {
  opacity: 0.3;
  filter: grayscale(1);
}

.toolbar-count {
  margin-left: auto;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.empty {
  padding: 2rem 0;
  text-align: center;
  color: var(--p-text-muted-color);
}

/* === Pool card === */
.pool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.pool-icons {
  display: flex;
}

.pool-icons img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: contain;
  background: var(--p-content-background);
  box-shadow: 0 0 0 2px var(--p-content-background);
}

.pool-icons img + img {
  margin-left: -6px;
}

.pool-tag {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--p-content-border-color);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.pool-name {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.pool-kind {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.pool-apr {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.pool-apr-value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.util-bar {
  position: relative;
  height: 4px;
  margin: 0.125rem 0 0.375rem;
  border-radius: 2px;
  background: var(--p-content-border-color);
}

.util-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--p-primary-color);
}

.util-bar > span.over {
  background: var(--p-orange-500);
}

.util-bar > i {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 10px;
  border-radius: 1px;
  background: var(--p-text-muted-color);
  transform: translateX(-1px);
}

.pool-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pool-actions > * {
  flex: 1;
}

.pool-actions + .pool-actions,
.card-pool :deep(.p-card-footer) .w-full {
  margin-top: 0.5rem;
}

.pool-action-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.pool-action-form input {
  flex: 1;
  min-width: 0;
}

.pool-tx-status {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .address-row {
    flex-direction: column;
  }

  .address-input-wrapper:has(.example-link) .address-input {
    padding-right: 1rem;
  }

  .example-link {
    position: static;
    transform: none;
    display: block;
    margin: 0.25rem 0 0 auto;
  }
}

@media (max-width: 640px) {
  .toolbar {
    position: static;
  }
}
</style>
