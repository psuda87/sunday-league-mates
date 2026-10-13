import { describe, expect, it } from 'vitest';
import { AccountError } from './api';
import type { Session } from './api';
import { SessionManager } from './sessionManager';
import type { RequestAccount } from './sessionManager';
import type { TokenStore } from './tokenStore';
function memory() {
  let token: string | null = null;
  const store: TokenStore = {read:async()=>token,write:async value=>{token=value;},clear:async()=>{token=null;}};
  return {store,peek:()=>token};
}
function session(temporary=false): Session {
  return {access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,
    user_id:crypto.randomUUID(),role:'member',must_change_password:temporary};
}
function api(fn:(action:string)=>Promise<unknown>):RequestAccount {return async <T>(action:string)=>await fn(action) as T;}
describe('zapisane sesje',()=>{
  it('po nowym uruchomieniu pokazuje dane dopiero po odpowiedzi serwera i zapisuje obrócony refresh',async()=>{
    const disk=memory(), first=session();
    await new SessionManager(disk.store,api(async()=>first)).signIn('Fikcyjny',crypto.randomUUID());
    expect(disk.peek()===first.refresh_token).toBe(true);
    let resolve!:(value:Session)=>void;
    const second=session(); const request=api(async action=>{
      expect(action).toBe('refresh');return new Promise<Session>(done=>{resolve=done;});
    });
    const restored=new SessionManager(disk.store,request);const pending=restored.refresh();
    await Promise.resolve();expect(restored.getSnapshot().phase).toBe('checking');expect(restored.getSnapshot().session).toBeNull();
    resolve(second);await pending;
    expect(restored.getSnapshot().phase).toBe('ready');expect(disk.peek()===second.refresh_token).toBe(true);
  });
  it('offline nie usuwa refresh, nie pokazuje profilu; odzyskuje dostęp po powrocie sieci',async()=>{
    const disk=memory();await disk.store.write(crypto.randomUUID());let online=false;
    const manager=new SessionManager(disk.store,api(async()=>{
      if(!online)throw new AccountError('Brak sieci','network_error');return session();
    }));
    await manager.refresh();expect(manager.getSnapshot().phase).toBe('unavailable');expect(manager.getSnapshot().session).toBeNull();expect(disk.peek()!==null).toBe(true);
    online=true;await manager.refresh();expect(manager.getSnapshot().phase).toBe('ready');
  });
  it('reset/cofnięcie sesji usuwa zapisane dane i nie przywraca dostępu',async()=>{
    const disk=memory();await disk.store.write(crypto.randomUUID());
    const manager=new SessionManager(disk.store,api(async()=>{throw new AccountError('Cofnięta','session_invalid');}));
    await manager.refresh();expect(manager.getSnapshot().phase).toBe('signed_out');expect(disk.peek()).toBeNull();
  });
  it('wylogowanie offline usuwa zapis; nowe uruchomienie nie loguje się',async()=>{
    const disk=memory();const manager=new SessionManager(disk.store,api(async action=>{
      if(action==='logout')throw new AccountError('Brak sieci','network_error');return session();
    }));
    await manager.signIn('Fikcyjny',crypto.randomUUID());await manager.logout();expect(disk.peek()).toBeNull();
    const restarted=new SessionManager(disk.store,api(async()=>{throw new Error('Nie wolno wywołać Auth');}));
    await restarted.refresh();expect(restarted.getSnapshot().phase).toBe('signed_out');
  });
  it('spóźniony refresh nie zapisuje tokenu i nie wznawia sesji po logout',async()=>{
    const disk=memory();await disk.store.write(crypto.randomUUID());let resolve!:(value:Session)=>void;
    const manager=new SessionManager(disk.store,api(async()=>new Promise<Session>(done=>{resolve=done;})));
    const pending=manager.refresh();await Promise.resolve();await manager.logout();resolve(session());await pending;
    expect(manager.getSnapshot().phase).toBe('signed_out');expect(disk.peek()).toBeNull();
  });
  it('wiele równoległych żądań powoduje jeden refresh',async()=>{
    const disk=memory();await disk.store.write(crypto.randomUUID());let count=0;
    const manager=new SessionManager(disk.store,api(async()=>{count++;return session();}));
    await Promise.all([manager.refresh(),manager.refresh(),manager.refresh()]);expect(count).toBe(1);
  });
  it('przywrócenie hasła tymczasowego nadal wymusza zmianę',async()=>{
    const disk=memory();await disk.store.write(crypto.randomUUID());
    const manager=new SessionManager(disk.store,api(async()=>session(true)));await manager.refresh();
    expect(manager.getSnapshot().session?.must_change_password).toBe(true);
  });
  it('odświeża wygasający access przed żądaniem i nie powtarza operacji zapisu',async()=>{
    const disk=memory(), calls:string[]=[];let now=0;
    const manager=new SessionManager(disk.store,api(async action=>{calls.push(action);return action==='save_profile'?{}:session();}),()=>now);
    await manager.signIn('Fikcyjny',crypto.randomUUID());now=3600*1000;await manager.call('save_profile');
    expect(calls).toEqual(['login','refresh','save_profile']);
  });
  it('błąd magazynu blokuje ekran; nie ma cichego niezabezpieczonego fallback',async()=>{
    const disk=memory();disk.store.write=async()=>{throw new AccountError('Błąd magazynu','storage_error');};
    const manager=new SessionManager(disk.store,api(async()=>session()));
    await expect(manager.signIn('Fikcyjny',crypto.randomUUID())).rejects.toMatchObject({code:'storage_error'});
    expect(manager.getSnapshot().phase).toBe('storage_error');expect(manager.getSnapshot().session).toBeNull();
  });
  it('powrót z tła odczytuje aktualny stan serwera i nie pokazuje starych danych',async()=>{
    const disk=memory();let invalid=false;
    const manager=new SessionManager(disk.store,api(async()=>{
      if(invalid)throw new AccountError('Cofnięta','session_invalid');return session();
    }));
    await manager.signIn('Fikcyjny',crypto.randomUUID());manager.suspend();
    expect(manager.getSnapshot().session).toBeNull();invalid=true;await manager.refresh();
    expect(manager.getSnapshot().phase).toBe('signed_out');expect(disk.peek()).toBeNull();
  });
  it('odświeżenie podczas zmiany hasła czeka na nową sesję',async()=>{
    const disk=memory();let now=0;let finish!:(value:Session)=>void;
    const manager=new SessionManager(disk.store,api(async action=>{
      if(action==='password')return new Promise<Session>(done=>{finish=done;});return session();
    }),()=>now);
    await manager.signIn('Fikcyjny',crypto.randomUUID());now=3600*1000;
    const change=manager.changeSession('password',{});await new Promise(done=>setTimeout(done,0));
    const resumed=manager.refresh();finish(session());await change;await resumed;
    expect(manager.getSnapshot().phase).toBe('ready');
  });
});
