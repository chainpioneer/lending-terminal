<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ balance: number; dailyEarnings: number; fetchedAt: string }>()
const now = ref(Date.now())
const fetchedAtMs = computed(() => Date.parse(props.fetchedAt))
const currency = computed(() => {
  const perSecond = Math.abs(props.dailyEarnings) / 86_400
  const digits = perSecond > 0 ? Math.min(8, Math.max(3, Math.ceil(-Math.log10(perSecond)))) : 3
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
})
const estimatedBalance = computed(() => {
  const elapsedDays = Math.max(0, now.value - fetchedAtMs.value) / 86_400_000
  const total = props.balance + props.dailyEarnings * elapsedDays
  return Number.isFinite(total) ? currency.value.format(total) : '—'
})

let timer: number
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 50)
})
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <span
    class="live-balance"
    :class="{ decreasing: dailyEarnings < 0 }"
    title="Estimated at the latest net earning rate"
  >
    <span class="sr-only">{{ estimatedBalance }}</span>
    <span aria-hidden="true" class="digits">
      <span v-for="(char, index) in estimatedBalance" :key="estimatedBalance.length - index" class="place">
        <Transition v-if="/[0-9]/.test(char)" name="roll">
          <span :key="char" class="digit">{{ char }}</span>
        </Transition>
        <template v-else>{{ char }}</template>
      </span>
    </span>
  </span>
</template>

<style scoped>
.live-balance {
  --travel: 100%;
  font-variant-numeric: tabular-nums;
}
.decreasing {
  --travel: -100%;
}
.digits {
  display: inline-flex;
  vertical-align: bottom;
}
.place {
  display: inline-block;
  position: relative;
  overflow: hidden;
}
.digit {
  display: block;
}
.roll-enter-active,
.roll-leave-active {
  transition: transform 240ms ease-out;
}
.roll-leave-active {
  position: absolute;
  inset: 0;
}
.roll-enter-from {
  transform: translateY(var(--travel));
}
.roll-leave-to {
  transform: translateY(calc(-1 * var(--travel)));
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (prefers-reduced-motion: reduce) {
  .roll-enter-active,
  .roll-leave-active {
    transition: none;
  }
}
</style>
