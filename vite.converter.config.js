// Сборка конвертера Guitar Pro в один скрипт для HUD (userscript грузит его с GitHub).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'src/generated',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: 'src/web/convert.js',
      name: 'FreakDJConvert',
      formats: ['iife'],
      fileName: () => 'gp-converter.js',
    },
  },
});
