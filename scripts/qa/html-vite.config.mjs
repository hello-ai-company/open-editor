import {fileURLToPath} from 'node:url';
import {defineConfig,mergeConfig} from 'vite';
import config from '../../examples/blocknote-power/vite.config.ts';
const local=path=>fileURLToPath(new URL(path,import.meta.url));
export default mergeConfig(config,defineConfig({
 root:local('../../examples/blocknote-power'),cacheDir:local('../../output/html27/vite-cache'),
 resolve:{alias:[{find:/^@hello-ai-company\/editor-blocknote\/notes$/,replacement:local('../../packages/blocknote/dist/notes/index.js')},{find:/^@hello-ai-company\/editor-blocknote\/react$/,replacement:local('../../packages/blocknote/dist/react/index.js')},{find:/^@hello-ai-company\/editor-blocknote\/power.css$/,replacement:local('../../packages/blocknote/dist/power.css')},{find:/^@hello-ai-company\/editor-blocknote$/,replacement:local('../../packages/blocknote/dist/index.js')},{find:/^@hello-ai-company\/editor-core$/,replacement:local('../../packages/core/dist/index.js')} ]},
 server:{host:'127.0.0.1',port:Number(process.env.OPENEDITOR_QA_PORT||5232),strictPort:true,fs:{allow:[local('../../../')]}}
}));
