import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionManager, SessionPhase } from '../auth/sessionManager';

// The native chooser can pause the Activity. Keep its input alive while protected
// views are hidden for revalidation, but never carry a result into another account.
export function usePhotoPicker(manager:SessionManager,phase:SessionPhase,userId?:string) {
  const input=useRef<HTMLInputElement>(null),owner=useRef<string|null>(null);
  const [pending,setPending]=useState<{owner:string;file:File}|null>(null);
  useEffect(()=>{
    if(phase==='signed_out'||(userId&&owner.current&&userId!==owner.current)){owner.current=null;setPending(null);}
  },[phase,userId]);
  const choose=useCallback(()=>{
    const auth=manager.getSnapshot();if(auth.phase!=='ready'||!auth.session)return;
    owner.current=auth.session.user_id;input.current?.click();
  },[manager]);
  const consumed=useCallback(()=>setPending(null),[]);
  return {choose,consumed,file:pending&&phase==='ready'&&pending.owner===userId?pending.file:undefined,
    input:<input ref={input} className="slm-photo-input" aria-label="Wybierz zdjęcie z galerii" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';
      if(file&&owner.current)setPending({owner:owner.current,file});
    }}/>};
}
