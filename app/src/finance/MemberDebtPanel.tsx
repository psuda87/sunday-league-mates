import {useCallback,useEffect,useRef,useState} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {AccountError} from '../auth/api';
import {formatCents} from '../settlements/model';
import {account} from './contracts';
import {memberDebt,matchesWord} from './memberDebt';
import type {MemberDebt} from './memberDebt';
import './memberDebt.css';

const day=(value:string)=>new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'medium'}).format(new Date(value));
type State={key:string;phase:'loading'}|{key:string;phase:'hidden'}|{key:string;phase:'error'}|{key:string;phase:'ready';debt:MemberDebt};

/**
 * Zadłużenie zawodnika w profilu — tylko dla administratora grupy.
 * Uprawnienie rozstrzyga serwer: konto administratora ma „surplus”, a odczyt cudzego konta bez uprawnień kończy się „forbidden”.
 * Dla zwykłego członka panel nic nie wyświetla i nie pobiera cudzych danych.
 */
export default function MemberDebtPanel({manager,userId,groupId,memberId}:{manager:SessionManager;userId:string;groupId:string;memberId:string}){
 const key=`${userId}:${groupId}:${memberId}`;
 const [state,setState]=useState<State>({key,phase:'loading'});
 const current=useRef(key);current.current=key;
 const [attempt,setAttempt]=useState(0);
 const load=useCallback(async()=>{
  const mine=key;
  const stale=()=>current.current!==mine||manager.getSnapshot().session?.user_id!==userId;
  try{
   const own=account(await manager.call('group_finance_account',{group_id:groupId}),groupId,userId);
   if(stale())return;
   if(own.surplus===null){setState({key:mine,phase:'hidden'});return;}
   const target=memberId===userId?own:account(await manager.call('group_finance_account',{group_id:groupId,user_id:memberId}),groupId,memberId);
   if(!stale())setState({key:mine,phase:'ready',debt:memberDebt(target)});
  }catch(e){
   if(stale())return;
   setState({key:mine,phase:e instanceof AccountError&&(e.code==='forbidden'||e.code==='not_found')?'hidden':'error'});
  }
 },[manager,userId,groupId,memberId,key]);
 useEffect(()=>{setState({key,phase:'loading'});void load();},[load,key,attempt]);
 // Po zmianie rozliczeń (wpłata, zatwierdzenie) profil pokazuje aktualny dług bez wychodzenia z ekranu.
 useEffect(()=>{const changed=()=>setAttempt(n=>n+1);window.addEventListener('slm-groups-changed',changed);return()=>window.removeEventListener('slm-groups-changed',changed);},[]);
 if(state.key!==key||state.phase==='hidden')return null;
 return <section className="slm-member-debt" aria-label="Zadłużenie zawodnika" aria-busy={state.phase==='loading'}>
  <h3>Zadłużenie</h3>
  {state.phase==='loading'&&<p role="status" className="slm-muted">Wczytywanie rozliczeń…</p>}
  {state.phase==='error'&&<><p role="alert">Nie udało się pobrać rozliczeń zawodnika.</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Spróbuj ponownie</button></>}
  {state.phase==='ready'&&(state.debt.totalCents>0
   ?<>
    <p className="slm-member-debt-total" data-state="owed"><span aria-hidden="true">⚠ </span><strong>Zaległość: {formatCents(state.debt.totalCents)}</strong> · {state.debt.matches.length} {matchesWord(state.debt.matches.length)}</p>
    <ul className="slm-member-debt-list">{state.debt.matches.map(d=><li key={d.event_id}><span>{day(d.starts_at)}</span><strong>{formatCents(d.outstanding_cents)}</strong></li>)}</ul>
   </>
   :<p className="slm-member-debt-total" data-state="clear"><span aria-hidden="true">✓ </span><strong>Brak zaległości</strong>{state.debt.creditCents>0&&<> · nadpłata {formatCents(state.debt.creditCents)}</>}</p>)}
  {state.phase==='ready'&&state.debt.pendingCount>0&&<p className="slm-muted">Zgłoszona wpłata czeka na decyzję: {formatCents(state.debt.pendingCents)}</p>}
  {state.phase==='ready'&&state.debt.blocked&&<p className="slm-member-debt-block"><span aria-hidden="true">⛔ </span>Zapisy na płatne mecze są zablokowane (co najmniej dwa zaległe mecze).</p>}
  {state.phase!=='error'&&<p className="slm-muted slm-member-debt-note">Widoczne tylko dla administratora grupy.</p>}
 </section>;
}
