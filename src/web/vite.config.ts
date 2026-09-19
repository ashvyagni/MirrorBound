import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    // Phaser alone is over the default 500 kB warning line, by design.
    chunkSizeWarningLimit: 1600,
    // Phaser is ~1.4 MB and never changes between deploys; keeping it in its
    // own chunk means app edits don't invalidate it in anyone's cache.
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
});
