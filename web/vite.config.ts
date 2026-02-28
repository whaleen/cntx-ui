import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Important: Use relative paths for serving from any location
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Reduce bundle size
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn: (warning, warn) => {
        if (
          warning.code === 'MISSING_EXPORT' &&
          warning.message.includes('child-process-proxy.js') &&
          warning.message.includes('spawn')
        ) {
          return
        }
        warn(warning)
      },
      output: {
        manualChunks: undefined, // Keep everything in one chunk for simplicity
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls during development
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
