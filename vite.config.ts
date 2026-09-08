import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build configuration.
 *
 * Note what is deliberately absent: no `define` block copying GEMINI_API_KEY
 * or any other secret into the browser bundle. Secrets stay on the server and
 * are reached through the /api proxies.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, '.'),
    },
  },
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.VITE_PORT ?? 5173),
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
