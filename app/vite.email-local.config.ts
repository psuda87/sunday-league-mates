// Explicit local-only callback test build. Never use for Cloud/APK activation.
import base from './vite.b1.config.ts';
export default {...base,plugins:[...base.plugins??[],{name:'mail-test-csp',apply:'build',transformIndexHtml:{order:'post',handler:(html:string)=>html.replaceAll('http://127.0.0.1:54321','http://127.0.0.1:60321')}}],define:{...base.define,'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:60321/functions/v1/accounts')},build:{...base.build,outDir:'../dist-email-local'}};
