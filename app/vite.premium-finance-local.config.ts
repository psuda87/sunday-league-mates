// Local test entry only. No .env, Cloud fallback, APK or default routing changes.
import base from './vite.b1.config.ts';
export default {...base,define:{...base.define,'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:64321/functions/v1/accounts')},plugins:[...base.plugins??[],{name:'premium-finance-local-csp',transformIndexHtml:{order:'post' as const,handler:(html:string)=>html.replaceAll('http://127.0.0.1:54321','http://127.0.0.1:64321')}}],server:{host:'127.0.0.1',port:5186,strictPort:true},build:{...base.build,outDir:'../dist-premium-finance-local'}};
