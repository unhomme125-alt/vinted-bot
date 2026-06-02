import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Vite + React + Tailwind v4 (plugin officiel) + alias shadcn "@/" → src
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Autorise l'accès via un tunnel public (Cloudflare *.trycloudflare.com, etc.)
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
