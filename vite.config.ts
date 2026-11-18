import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  worker: { format: 'es' },
  build: { outDir: '../../dist', emptyOutDir: true },
});
