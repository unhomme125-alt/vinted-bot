import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api vers le backend Express en développement.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Autorise l'accès via un tunnel public (Cloudflare *.trycloudflare.com, etc.)
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
