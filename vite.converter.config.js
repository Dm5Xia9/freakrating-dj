// Сборка конвертера Guitar Pro в один скрипт для HUD (userscript грузит его с GitHub).
import { defineConfig } from 'vite';
import parserMixerPatch from './vite.parser-patch.js';

export default defineConfig({
  plugins: [parserMixerPatch()],
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
