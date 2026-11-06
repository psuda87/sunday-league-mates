import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACCOUNTS,CSP,premiumWebConfig} from './build-premium-web.mjs';
const base={root:'/existing/app/b1',plugins:[],define:{'import.meta.env.VITE_SLM_FUNCTION_URL':'"http://127.0.0.1:54321/functions/v1/accounts"'},build:{outDir:'../dist-b1'}};
test('uses the EXISTING Premium entry and only whitelisted public build values',()=>{
 const c=premiumWebConfig(base,{SUPABASE_SERVICE_ROLE_KEY:'MUST_NOT_SHIP',VERCEL_TOKEN:'MUST_NOT_SHIP'});
 assert.equal(c.root,base.root);assert.equal(c.configFile,false);assert.equal(c.envDir,false);assert.deepEqual(c.envPrefix,[]);
 assert.equal(JSON.parse(c.define['import.meta.env.VITE_SLM_FUNCTION_URL']),ACCOUNTS);assert.equal(c.build.outDir,'../dist-premium-web');assert.equal(c.build.sourcemap,false);
 assert(!JSON.stringify(c).includes('MUST_NOT_SHIP'));
});
test('rejects other projects, localhost, insecure URLs and credential-bearing legal links',()=>{
 for(const value of ['http://127.0.0.1:54321/functions/v1/accounts','https://other.supabase.co/functions/v1/accounts',ACCOUNTS+'?redirect=evil'])assert.throws(()=>premiumWebConfig(base,{VITE_SLM_FUNCTION_URL:value}));
 for(const value of ['http://example.invalid','https://u:p@example.invalid','https://localhost/terms'])assert.throws(()=>premiumWebConfig(base,{VITE_SLM_TERMS_URL:value}));
});
test('rewrites only document policy/title; Vercel serves the same strict CSP and SPA callback',()=>{
 const c=premiumWebConfig(base,{}),html=readFileSync(new URL('../b1/index.html',import.meta.url),'utf8');
 const out=c.plugins.at(-1).transformIndexHtml(html);
 assert(out.includes('<title>Sunday League Mates</title>'));assert(!out.includes('127.0.0.1'));assert(out.includes("connect-src 'self' https://hjtcyybkxebvdropchac.supabase.co"));
 assert(!out.includes('frame-ancestors'));assert.throws(()=>c.plugins.at(-1).transformIndexHtml('unexpected'));
 const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(vercel.buildCommand,'npm run build:premium-web');assert.equal(vercel.outputDirectory,'dist-premium-web');assert.equal(vercel.git.deploymentEnabled,false);
 assert.equal(vercel.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value,CSP);
 assert.deepEqual(vercel.rewrites,[{source:'/(.*)',destination:'/index.html'}]);assert(CSP.includes("frame-ancestors 'none'"));assert(!CSP.includes('unsafe-eval'));assert(!CSP.includes('https:;'));assert(!CSP.includes('*'));
});
