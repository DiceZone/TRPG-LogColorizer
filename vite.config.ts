import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

const pathSrc = path.resolve(__dirname, 'src')
// 版本号 = 构建日期（北京时间）
const buildDate = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')

// 开发时连线上的日志后端：线上后端只放行自己的站点来源，本地页面直接请求会被 CORS 挡下。
// 设了 LOG_DEV_PROXY（如 https://log-api.dice.zone）时，开发服务器把 /api 转发过去，
// 页面只请求同源的 /api/dice，就不会跨域。只影响 pnpm dev，构建产物不受影响。
const devProxy = process.env.LOG_DEV_PROXY?.replace(/\/+$/, '')

export default defineConfig({
  server: devProxy
    ? { proxy: { '/api': { target: devProxy, changeOrigin: true, secure: true } } }
    : undefined,
  resolve: {
    alias: {
      '~/': `${pathSrc}/`,
    },
  },
  base: './',
  // 暴露给页面的环境变量前缀（LOG_API_BASE / LOG_THEME / RKEY_API_BASE 等）
  envPrefix: ['VITE_', 'LOG_', 'RKEY_'],
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    vue(),
    Components({
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
})
