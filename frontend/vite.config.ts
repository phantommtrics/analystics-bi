import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Lower peak RAM on small VPS builds (avoids Linux OOM "Killed")
    reportCompressedSize: false,
    sourcemap: false,
  },
})
