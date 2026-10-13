import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import config from '../../examples/blocknote-power/vite.config.ts';
export default mergeConfig(config,defineConfig({
  root:fileURLToPath(new URL('../../examples/blocknote-power',import.meta.url)),
  cacheDir:fileURLToPath(new URL('../../output/widget23/vite-cache',import.meta.url)),
  server:{host:'127.0.0.1',port:Number(process.env.OPENEDITOR_QA_PORT||5225),strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../',import.meta.url))]}}
}));
