import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Flow 5 (Case Intake) → litigation-service จริง (remote)
      '/litigation-api': {
        target: process.env.LITIGATION_API_URL || 'http://172.26.59.78/api/litigation-service',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/litigation-api/, ''),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['bpmn-js'],
  },
  assetsInclude: ['**/*.bpmn'],
});
