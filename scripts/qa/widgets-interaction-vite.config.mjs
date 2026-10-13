// Isolated QA server only. Own cache; shared workspace dependencies are read-only reused.
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import config from '../../examples/blocknote-power/vite.config.ts';
export default mergeConfig(config, defineConfig({
  root: fileURLToPath(new URL('../../examples/blocknote-power', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../../output/widget22/vite-cache', import.meta.url)),
  server: { host: '127.0.0.1', port: 5224, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } }
}));
