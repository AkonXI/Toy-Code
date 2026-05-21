import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^moment$/, replacement: resolve(__dirname, 'src/vendor/moment.js') },
      { find: /^moment\//, replacement: resolve(__dirname, 'node_modules/moment') + '/' },
      { find: /^@\//, replacement: resolve(__dirname, 'src') + '/' },
    ],
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  server: {
    port: 3005,
    proxy: {
      '/org': { target: 'http://localhost:8080', changeOrigin: true },
      '/tpm-bd-screen': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
