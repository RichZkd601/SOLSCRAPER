import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Fix HMR for Codespace / remote environments
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',  ws: true, changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
