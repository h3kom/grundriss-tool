import { defineConfig } from 'vite';

export default defineConfig({
  base: '/grundriss-tool/dev/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Suppress warnings about chunk size
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
});