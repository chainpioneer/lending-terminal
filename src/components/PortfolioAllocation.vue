<script setup lang="ts">
import { computed } from 'vue'
import { allocationDebtLabel, allocationIdleLabel, type PortfolioAllocation } from '../logic/portfolioAllocation'
import { toUSDCurrency } from '../utils/formatting'

const props = defineProps<{ allocation: PortfolioAllocation }>()
const assets = computed(() => props.allocation.filter((group) => group.usd > 0))
const segments = computed(() => {
  let offset = 0
  return assets.value.map((group) => {
    const segment = { color: group.color, share: group.share * 100, offset }
    offset += segment.share
    return segment
  })
})
</script>

<template>
  <section class="allocation" aria-labelledby="allocation-title">
    <h3 id="allocation-title">Portfolio allocation</h3>
    <p class="text-secondary">Supplied + idle assets, before debt.</p>
    <div v-if="assets.length" class="allocation-content">
      <svg
        viewBox="0 0 220 220"
        class="allocation-chart"
        role="img"
        aria-label="Asset allocation by USD value. Category breakdown in the table."
      >
        <g fill="none" stroke-width="24" transform="rotate(-90 110 110)">
          <circle
            v-for="(segment, i) in segments"
            :key="i"
            cx="110"
            cy="110"
            r="85"
            pathLength="100"
            :stroke="segment.color"
            :stroke-dasharray="`${segment.share} ${100 - segment.share}`"
            :stroke-dashoffset="-segment.offset"
          />
        </g>
      </svg>
      <table class="allocation-legend">
        <thead>
          <tr>
            <th>Category</th>
            <th>Share</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in assets" :key="group.label">
            <th scope="row">
              <span class="allocation-dot" :style="{ background: group.color }"></span>{{ group.label }}
            </th>
            <td>
              <strong>{{ (group.share * 100).toFixed(1) }}%</strong>
            </td>
            <td class="text-secondary">{{ toUSDCurrency(group.usd.toFixed(0)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-secondary">No assets to display.</p>
    <div class="allocation-summary">
      <p>{{ allocationIdleLabel(allocation) }}</p>
      <p>{{ allocationDebtLabel(allocation) }}</p>
    </div>
  </section>
</template>

<style scoped>
.allocation {
  margin: 1.25rem 0;
  padding: 1.25rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
}
h3 {
  margin: 0;
}
p {
  font-size: 0.85rem;
}
.allocation-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.allocation-chart {
  width: 220px;
  max-width: 100%;
  flex-shrink: 0;
}
.allocation-legend {
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 0.5rem;
  text-align: right;
}
th:first-child {
  padding-left: 0;
  text-align: left;
}
thead th {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  font-weight: 400;
}
.allocation-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 0.5rem;
}
.allocation-summary p {
  margin: 0.35rem 0;
}
</style>
