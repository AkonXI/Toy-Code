import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'electron/renderer',
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: resolve(__dirname, 'auto-imports.d.ts')
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: resolve(__dirname, 'components.d.ts')
    }),
    electron({
      main: {
        entry: resolve(__dirname, 'electron/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'build/app/dist-electron'),
            emptyOutDir: true,
            minify: false,
            rolldownOptions: {
              external: ['better-sqlite3'],
              output: { entryFileNames: 'main.js' }
            }
          }
        },
        onstart(args) {
          args.startup(['.', '--no-sandbox', '--enable-logging'], { cwd: __dirname })
        }
      },
      preload: {
        input: { preload: resolve(__dirname, 'electron/preload/index.ts') },
        vite: {
          build: {
            outDir: resolve(__dirname, 'build/app/dist-electron'),
            emptyOutDir: false,
            minify: false,
            rolldownOptions: {
              external: ['electron'],
              output: {
                format: 'es',
                entryFileNames: '[name].mjs',
                chunkFileNames: '[name].mjs'
              }
            }
          }
        }
      }
    })
  ],
  build: {
    outDir: resolve(__dirname, 'build/app/dist'),
    emptyOutDir: true,
    rolldownOptions: {
      input: resolve(__dirname, 'electron/renderer/index.html')
    }
  }
})
