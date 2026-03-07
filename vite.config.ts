import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "production"  ? "/lending-terminal/" : '',
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'web3': ['web3', 'web3-validator'],
          'ethers': ['ethers', 'ethcall'],
          'vue': ['vue', 'primevue', '@primevue/themes'],
        },
      },
    },
  },
})
