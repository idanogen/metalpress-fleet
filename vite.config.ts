import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/make': {
        target: 'https://us1.make.com/api/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/make/, ''),
      },
    },
  },
})
