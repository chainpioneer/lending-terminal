<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

defineProps<{ showBreakdown?: boolean }>()

const popover = ref()
function toggle(event: any) {
  popover.value?.toggle(event)
}
</script>

<template>
  <p class="m-0">
    <slot />
    <label v-if="showBreakdown" @click="toggle">ℹ️</label>
  </p>
  <Popover ref="popover">
    <slot name="breakdown" />
  </Popover>
</template>

<style scoped>
label {
  cursor: pointer;
}
</style>
