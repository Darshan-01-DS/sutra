import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'icons/*', dest: 'icons' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup/popup.html'),
        content: path.resolve(__dirname, 'content/content.ts'),
        serviceWorker: path.resolve(__dirname, 'background/service-worker.ts')
      },
      output: {
        entryFileNames(chunkInfo) {
          if (chunkInfo.name === 'content') {
            return 'content/content.js';
          }
          if (chunkInfo.name === 'serviceWorker') {
            return 'background/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames(assetInfo) {
          if (assetInfo.name === 'popup.css') {
            return 'popup/popup.css';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});