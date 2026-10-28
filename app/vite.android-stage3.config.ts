// Explicit opt-in Android acceptance build; default production entry is unchanged.
import base from './vite.premium-finance-local.config.ts';
import { fileURLToPath } from 'node:url';
export default {...base,
 root:fileURLToPath(new URL('./android-stage3',import.meta.url)),
 build:{...base.build,outDir:'../dist-android-stage3',rollupOptions:{input:fileURLToPath(new URL('./android-stage3/index.html',import.meta.url))}},
};
