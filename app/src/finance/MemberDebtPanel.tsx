import {useCallback,useEffect,useRef,useState} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {AccountError} from '../auth/api';
import {formatCents,parseCents} from '../settlements/model';
import {financeChangedEvent} from './paymentsIntent';
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
 const [amount,setAmount]=useState(''),[saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[notice,setNotice]=useState('');
 // Ten sam identyfikator dla tej samej kwoty, dopóki zapis nie zostanie potwierdzony: ponowienie nie zdubluje wpłaty.
 const intent=useRef<{fingerprint:string;id:string}|null>(null);
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

 async function record(){
  setFormError('');setNotice('');
  let cents:number;try{cents=parseCents(amount);}catch(e){setFormError(e instanceof Error?e.message:'Podaj kwotę wpłaty.');return;}
  const fingerprint=`${key}:${cents}`;
  if(intent.current?.fingerprint!==fingerprint)intent.current={fingerprint,id:crypto.randomUUID()};
  setSaving(true);
  try{
   await manager.call('group_finance_record_payment',{group_id:groupId,user_id:memberId,amount_cents:cents,reason:'Wpłata zapisana przez administratora w profilu zawodnika',request_id:intent.current.id});
   intent.current=null;setAmount('');setNotice(`Zapisano wpłatę ${formatCents(cents)}. Nadwyżka ponad zaległość zostaje jako nadpłata.`);
   setAttempt(n=>n+1);window.dispatchEvent(new Event(financeChangedEvent));
  }catch(e){
   const code=e instanceof AccountError?e.code:'';
   setFormError(code==='already_paid'?'Zawodnik nie ma zaległości do pokrycia.':code==='pending_payment_exists'?'Zawodnik zgłosił już wpłatę. Potwierdź zgłoszenie w rozliczeniach zamiast wpisywać nową.':code==='forbidden'?'Brak uprawnień do zapisania wpłaty.':'Nie potwierdzono zapisu wpłaty. Sprawdź stan po odświeżeniu przed ponowną próbą.');
   setAttempt(n=>n+1);
  }finally{setSaving(false);}
 }
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
   :<p className="slm-member-debt-total" data-state="clear"><span aria-hidden="true">✓ </span><strong>Brak zaległości</strong>{state.debt.creditCents>0&&<> · nadpłata {formatCents(state.debt.creditCents)} (zaliczana na kolejne mecze)</>}</p>)}
  {state.phase==='ready'&&state.debt.pendingCount>0&&<p className="slm-muted">Zgłoszona wpłata czeka na decyzję: {formatCents(state.debt.pendingCents)}</p>}
  {state.phase==='ready'&&state.debt.blocked&&<p className="slm-member-debt-block"><span aria-hidden="true">⛔ </span>Zapisy na płatne mecze są zablokowane (co najmniej dwa zaległe mecze).</p>}
  {state.phase==='ready'&&state.debt.totalCents>0&&state.debt.pendingCount===0&&<form className="slm-member-debt-form" onSubmit={e=>{e.preventDefault();void record();}}>
   <label>Wpłata zawodnika (zł)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="np. 100" disabled={saving}/></label>
   <button type="submit" disabled={saving||!amount.trim()}>{saving?'Zapisywanie…':'Zapisz wpłatę'}</button>
   <p className="slm-muted">Kwota wyższa niż zaległość zostaje na koncie jako nadpłata i pokrywa kolejne mecze.</p>
  </form>}
  {formError&&<p role="alert">{formError}</p>}
  {notice&&<p role="status">{notice}</p>}
  {state.phase!=='error'&&<p className="slm-muted slm-member-debt-note">Widoczne tylko dla administratora grupy.</p>}
 </section>;
}
