import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The full main runtime, with all real API screens; never the demo world.
export default defineConfig({
 envDir:false,envPrefix:[],plugins:[react()],
 define:{'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:54321/functions/v1/accounts')},
 build:{outDir:'dist-live-local',emptyOutDir:true,sourcemap:false},
});
