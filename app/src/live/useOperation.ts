import { useRef, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
export function useOperation(manager: SessionManager) {
  const flight = useRef(false);
  const requests = useRef(new Map<string,string>());
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function mutate<T>(action:string,body:Record<string,unknown> = {}):Promise<T> {
    const fingerprint=JSON.stringify([action,body]);
    let request=requests.current.get(fingerprint);
    if(!request){request=crypto.randomUUID();requests.current.set(fingerprint,request);}
    const result=await manager.call<T>(action,{...body,request_id:request});
    requests.current.delete(fingerprint);
    return result;
  }
  async function run(task:()=>Promise<void>) {
    if(flight.current)return;flight.current=true;setBusy(true);setError('');
    try{await task();}catch(e){setError(e instanceof Error?e.message:'Nie udało się wykonać operacji.');}
    finally{flight.current=false;setBusy(false);}
  }
  return {busy,error,run,mutate};
}
