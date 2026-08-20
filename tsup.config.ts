import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  clean: true,
  dts: true,
  sourcemap: true,
  onSuccess: async () => {
    // Copy UI + template + assets into dist for production
    mkdirSync('dist/ui', { recursive: true });
    mkdirSync('dist/assets', { recursive: true });
    copyFileSync('src/ui/index.html', 'dist/ui/index.html');
    copyFileSync('og-image.html', 'dist/og-image.html');
    const assets = readdirSync('assets');
    for (const file of assets) {
      copyFileSync(`assets/${file}`, `dist/assets/${file}`);
    }
    console.log('Copied ui/index.html, og-image.html, and assets/ to dist/');
  },
});
