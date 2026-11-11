import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Port 5175 keeps this dev server clear of the other projects' servers.
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
  // MapLibre starts its tile worker as an ES module worker.
  worker: { format: 'es' },
  build: {
    // MapLibre is loaded on demand and is large by itself; the app shell stays small.
    chunkSizeWarningLimit: 1100,
  },
})
