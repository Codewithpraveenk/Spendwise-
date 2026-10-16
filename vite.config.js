import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', 'Referrer-Policy': 'no-referrer-when-downgrade' }, proxy: { '/api': { target: process.env.SPENDWISE_API_TARGET || 'http://127.0.0.1:5000', changeOrigin: true } } },
});
