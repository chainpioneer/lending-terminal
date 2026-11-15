<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { allocationDebtLabel, allocationIdleLabel, type PortfolioAllocation } from '../logic/portfolioAllocation'

const props = defineProps<{
  allocation: PortfolioAllocation
  apr: string
  aprWithIdle: string
  summary: { protocols: number; chains: number; assets: number; positions: number }
  fetchedAt: string
}>()
const url = 'https://chainpioneer.github.io/lending-terminal/'
const visible = ref(false)
const imageUrl = ref('')
const status = ref('')
const xReady = ref(false)
let file: File | undefined
const text = computed(
  () =>
    `My aggregate lending portfolio APR: ${props.apr} excluding idle, ${props.aprWithIdle} including idle. ${props.summary.protocols} protocols · ${props.summary.chains} chains · ${props.summary.assets} assets · ${props.summary.positions} positions. Check your yield with Lending Terminal.`,
)
const tweetUrl = computed(() => `https://twitter.com/intent/tweet?${new URLSearchParams({ text: text.value, url })}`)

async function prepare() {
  visible.value = true
  status.value = ''
  xReady.value = false
  file = undefined
  URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#101d19'
    ctx.fillRect(0, 0, 1200, 630)
    const write = (value: string, x: number, y: number, size: number, color = '#eaf5ef', bold = false) => {
      ctx.fillStyle = color
      ctx.font = `${bold ? 700 : 400} ${size}px system-ui, sans-serif`
      ctx.fillText(value, x, y)
    }
    write('LENDING TERMINAL', 64, 70, 22, '#73dfa5', true)
    const writeApr = (value: string, x: number, size: number, color = '#73dfa5') => {
      ctx.font = `700 ${size}px system-ui, sans-serif`
      const fittedSize = Math.min(size, (size * 270) / Math.max(ctx.measureText(value).width, 1))
      write(value, x, 285, fittedSize, value.startsWith('-') ? '#ff9898' : color, true)
    }
    writeApr(props.apr, 58, 78)
    writeApr(props.aprWithIdle, 365, 48, '#91a7ff')
    write('APR · EXCL. IDLE', 64, 323, 17, '#a9bfb3')
    write('APR · INCL. IDLE', 365, 323, 17, '#a9bfb3')
    write('ASSET MIX', 690, 165, 18, '#a9bfb3')
    write('Including idle · before debt', 690, 185, 13, '#a9bfb3')
    const assets = props.allocation.filter((group) => group.usd > 0)
    if (assets.length) {
      let angle = -Math.PI / 2
      for (const group of assets) {
        const end = angle + group.share * Math.PI * 2
        ctx.beginPath()
        ctx.arc(770, 270, 64, angle, end)
        ctx.strokeStyle = group.color
        ctx.lineWidth = 16
        ctx.stroke()
        angle = end
      }
      assets.forEach((group, i) => {
        const y = 220 + i * 32
        ctx.fillStyle = group.color
        ctx.fillRect(875, y - 12, 10, 10)
        write(group.label, 898, y, 18)
        write(`${(group.share * 100).toFixed(1)}%`, 1035, y, 18, group.color, true)
      })
    } else {
      write('No assets', 690, 260, 22, '#a9bfb3')
    }
    write(
      `${allocationIdleLabel(props.allocation)} · ${allocationDebtLabel(props.allocation)}`,
      690,
      370,
      14,
      '#a9bfb3',
    )
    Object.entries(props.summary).forEach(([label, value], i) => {
      write(String(value), 64 + i * 276, 421, 40, '#eaf5ef', true)
      write(label.toUpperCase(), 64 + i * 276, 457, 16, '#a9bfb3')
    })
    write('Snapshot APRs · Available rewards included · Net of supported borrowing costs', 64, 530, 16, '#a9bfb3')
    write('chainpioneer.github.io/lending-terminal', 64, 593, 21, '#73dfa5')
    write(new Date(props.fetchedAt).toISOString().slice(0, 10) + ' UTC', 925, 593, 17, '#a9bfb3')
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image unavailable'))), 'image/png'),
    )
    file = new File([blob], 'lending-terminal-apr.png', { type: 'image/png' })
    imageUrl.value = URL.createObjectURL(blob)
  } catch {
    status.value = 'Could not create the image. Close this window and try again.'
  }
}
async function copyImage(forX = false) {
  if (!file) return
  xReady.value = false
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': file })])
    xReady.value = true
    status.value = forX
      ? 'Image copied. Open X, then paste with ⌘V / Ctrl+V.'
      : 'Image copied. Paste into any app with ⌘V / Ctrl+V.'
  } catch {
    xReady.value = forX
    status.value = 'Image copying is unavailable in this browser. Download the PNG and attach it to your post.'
  }
}
onBeforeUnmount(() => URL.revokeObjectURL(imageUrl.value))
</script>

<template>
  <Button label="Share result" severity="secondary" outlined @click="prepare" />
  <Dialog v-model:visible="visible" modal header="Share your result" :style="{ width: '760px', maxWidth: '95vw' }">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      class="share-preview"
      alt="Portfolio APRs excluding and including idle, share card with asset allocation, idle share and debt ratio and protocol, chain, asset and position counts"
    />
    <p class="text-secondary">
      APR, asset allocation, idle share, debt-to-assets ratio and portfolio counts only. No addresses or balances.
    </p>
    <div v-if="imageUrl" class="share-actions">
      <a v-if="xReady" :href="tweetUrl" target="_blank" rel="noopener noreferrer" class="p-button"
        >Open X → paste image</a
      >
      <Button v-else label="Share on X" @click="copyImage(true)" />
      <Button label="Copy image" severity="secondary" outlined @click="copyImage()" />
    </div>
    <p v-if="imageUrl" class="share-note">
      Paste the image into your post. Text and link are prefilled on X.
      <a :href="imageUrl" download="lending-terminal-apr.png">Download PNG</a>
    </p>
    <p role="status">{{ status }}</p>
  </Dialog>
</template>

<style scoped>
.share-preview {
  display: block;
  width: 100%;
  border-radius: 12px;
}
.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.share-note {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}
</style>
