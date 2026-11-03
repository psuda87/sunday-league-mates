// Isolated integration/browser transport; never used by default or APK builds.
import base from './vite.b1.config.ts';
export default {...base,define:{...base.define,'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:55321/functions/v1/accounts')},plugins:[...base.plugins??[],{name:'stabilization-local-csp',transformIndexHtml:{order:'post' as const,handler:(html:string)=>html.replaceAll('http://127.0.0.1:54321','http://127.0.0.1:55321')}}],server:{host:'127.0.0.1',port:5196,strictPort:true}};
