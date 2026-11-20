import { defineConfig } from 'vite';
import parserMixerPatch from './vite.parser-patch.js';

export default defineConfig({
  plugins: [parserMixerPatch()],
  optimizeDeps: { exclude: ['guitarpro-parser'] },   // иначе пребандлинг обойдёт патч микшера
  base: '/freakrating-dj/',
});
