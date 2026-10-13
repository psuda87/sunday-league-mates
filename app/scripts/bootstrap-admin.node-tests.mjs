import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { checkFirstAdmin, createFirstAdmin, validateBootstrap } from './bootstrap-admin-core.mjs';
const values = () => ({login:' Żółw_Test ',phone:'+1 (202) 555-0111',password:randomBytes(24).toString('base64url'),confirm:'CREATE_FIRST_ADMIN'});

test('walidacja nie zgaduje kraju, wymaga świadomego potwierdzenia i limitu UTF-8', () => {
  const input=values();
  const validated=validateBootstrap(input);
  assert.equal(validated.login,'Żółw_Test'); assert.equal(validated.phone,'+12025550111');
  assert.throws(()=>validateBootstrap({...input,confirm:''}),/Potwierdzenie/);
  assert.throws(()=>validateBootstrap({...input,phone:'2025550111'}),/prefiksu/);
  assert.doesNotThrow(()=>validateBootstrap({...input,password:randomBytes(6).toString('base64url')}));
  assert.throws(()=>validateBootstrap({...input,password:randomBytes(5).toString('base64url')}),/minimum 8/);
  assert.throws(()=>validateBootstrap({...input,password:'ą'.repeat(37)}),/72 bajty/);
});
test('istniejący administrator blokuje wszystkie zapisy', async () => {
  const methods=[];
  const api={request:async (_path,method='GET')=>{methods.push(method);return {ok:true,data:[{user_id:randomUUID()}]};}};
  await assert.rejects(createFirstAdmin(api,values()),/Administrator już istnieje/);
  assert.deepEqual(methods,['GET']);
});
test('Admin API i provision tworzą administratora, a odczyt potwierdza wymuszoną zmianę', async () => {
  const id=randomUUID(), input=values(); const methods=[];
  const api={request:async (path,method='GET',body)=>{
    methods.push(method);
    if(path.includes('role=eq.admin')) return {ok:true,data:[]};
    if(path==='/auth/v1/admin/users') {
      assert.ok(body.email_confirm===true && body.password===input.password && body.email.endsWith('@slm.invalid'),'Admin API: potwierdzenie i dane tylko w pamięci');
      return {ok:true,data:{id}};
    }
    if(path.includes('/rpc/')) {assert.ok(body.p_admin===true && body.p_actor===undefined,'wyłącznie owner provision');return {ok:true,data:null};}
    if(path.includes('slm_account_security')) return {ok:true,data:[{must_change_password:true,active:true,operation_id:null}]};
    return {ok:true,data:[{role:'admin'}]};
  }};
  await createFirstAdmin(api,input); assert.deepEqual(methods,['GET','POST','POST','GET','GET']);
});
test('błąd provision usuwa wyłącznie własne nowe konto', async () => {
  const id=randomUUID(); let deleted=false;
  const api={request:async (path,method='GET')=>{
    if(path.includes('role=eq.admin')) return {ok:true,data:[]};
    if(path==='/auth/v1/admin/users') return {ok:true,data:{id}};
    if(method==='DELETE') {assert.ok(path.endsWith(id),'cleanup wyłącznie nowego konta');deleted=true;return {ok:true};}
    return {ok:false,data:null};
  }};
  await assert.rejects(createFirstAdmin(api,values()),/Nie ukończono bootstrap/);assert.ok(deleted);
});
test('niedostępny odczyt administratorów blokuje bootstrap', async () => {
  await assert.rejects(checkFirstAdmin({request:async()=>({ok:false,data:null})}),/Nie udało się sprawdzić/);
});
test('brak wymuszonej zmiany hasła nie jest uznawany za sukces bootstrap', async () => {
  const id=randomUUID(); let deleted=false;
  const api={request:async (path,method='GET')=>{
    if(path.includes('role=eq.admin')) return {ok:true,data:[]};
    if(path==='/auth/v1/admin/users') return {ok:true,data:{id}};
    if(method==='DELETE') {assert.ok(path.endsWith(id),'cleanup wyłącznie nowego konta');deleted=true;return {ok:true};}
    if(path.includes('/rpc/')) return {ok:true,data:null};
    if(path.includes('slm_account_security')) return {ok:true,data:[{must_change_password:false,active:true,operation_id:null}]};
    return {ok:true,data:[{role:'admin'}]};
  }};
  await assert.rejects(createFirstAdmin(api,values()),/Nie ukończono bootstrap/);assert.ok(deleted);
});
