<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

defineProps<{ label?: string; showBreakdown?: boolean }>()

const popover = ref()
function toggle(event: any) {
  popover.value?.toggle(event)
}
</script>

<template>
  <p class="stat">
    <span v-if="label" class="stat-label">{{ label }}</span>
    <span class="stat-value">
      <slot />
      <button v-if="showBreakdown" type="button" class="stat-info" aria-label="Show breakdown" @click="toggle">
        i
      </button>
    </span>
  </p>
  <Popover ref="popover">
    <slot name="breakdown" />
  </Popover>
</template>

<style scoped>
.stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.3rem 0;
}

.stat-label {
  flex-shrink: 0;
  color: var(--p-text-muted-color);
}

.stat-value {
  min-width: 0;
  text-align: right;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.stat-info {
  display: inline-grid;
  place-items: center;
  width: 1.15em;
  height: 1.15em;
  margin-left: 0.35em;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: none;
  color: var(--p-text-muted-color);
  font:
    600 0.75em/1 Georgia,
    serif;
  font-style: italic;
  vertical-align: 0.1em;
  cursor: pointer;
}

.stat-info:hover,
.stat-info:focus-visible {
  color: var(--p-primary-color);
}
</style>
