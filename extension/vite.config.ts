import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@detectors': resolve(__dirname, 'src/detectors'),
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    outDir: 'dist',
    emptyDirOnBuildStart: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
