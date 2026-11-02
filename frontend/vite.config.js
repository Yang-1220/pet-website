import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发服务器将 /api 请求代理到后端 http://localhost:3000
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
