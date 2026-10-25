import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// Explicit local-only endpoint: never inherit an .env or production fallback.
export default defineConfig({
 root:fileURLToPath(new URL('./b1',import.meta.url)),envDir:false,envPrefix:[],
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 define:{'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:54321/functions/v1/accounts')},
 plugins:[react()],build:{outDir:'../dist-b1',emptyOutDir:true,sourcemap:false},
});
