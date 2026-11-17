import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// * 개발 중 /api 요청은 Spring Boot(8080)로 넘긴다. Spring의 app.frontend-origin과 같은 5173 포트를 사용한다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
