import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// scripts/start.js picks a free API port and passes it in; 5000 is the default.
const api = `http://localhost:${process.env.API_PORT || 5000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
