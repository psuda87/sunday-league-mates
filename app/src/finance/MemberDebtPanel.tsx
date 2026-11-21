import {useCallback,useEffect,useRef,useState} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {AccountError} from '../auth/api';
import {formatCents,parseCents} from '../settlements/model';
import {financeChangedEvent} from './paymentsIntent';
import {account} from './contracts';
import {memberDebt,matchesWord} from './memberDebt';
import type {MemberDebt} from './memberDebt';
import type {Receipt} from './contracts';
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

 // Decyzje o wpłatach z profilu: ten sam identyfikator dla tej samej decyzji, dopóki serwer jej nie potwierdzi.
 const decisionIds=useRef(new Map<string,string>());
 const [deciding,setDeciding]=useState('');
 // Kwota wpisywana przez administratora przy każdej wpłacie; domyślnie kwota z serwera.
 const [typed,setTyped]=useState<Record<string,string>>({});
 const step=async(action:string,fingerprint:string,body:Record<string,unknown>)=>{
  let id=decisionIds.current.get(fingerprint);if(!id){id=crypto.randomUUID();decisionIds.current.set(fingerprint,id);}
  await manager.call(`group_finance_${action}`,{group_id:groupId,...body,request_id:id});decisionIds.current.delete(fingerprint);
 };
 async function decide(action:'accept_payment'|'reject_payment'|'cancel_payment'|'correct_payment',p:Receipt){
  if(deciding)return;
  setFormError('');setNotice('');
  let cents=p.corrected_amount_cents;
  if(action==='accept_payment'||action==='correct_payment'){
   const raw=typed[p.id];if(raw!==undefined&&raw.trim()){try{cents=parseCents(raw);}catch(e){setFormError(e instanceof Error?e.message:'Podaj kwotę wpłaty.');return;}}
   if(cents<=0){setFormError('Kwota musi być większa od zera. Aby usunąć wpłatę, użyj „Odrzuć” lub „Cofnij”.');return;}
  }
  setDeciding(p.id);
  const reasons={accept_payment:'Akceptacja zgłoszonej wpłaty w profilu zawodnika',reject_payment:'Odrzucenie zgłoszonej wpłaty w profilu zawodnika',cancel_payment:'Anulowanie zatwierdzonej wpłaty w profilu zawodnika',correct_payment:'Korekta kwoty wpłaty w profilu zawodnika'};
  const scope={...(p.event_id?{event_id:p.event_id}:{})};
  const fp=(a:string,extra='')=>`${key}:${a}:${p.id}${extra}`;
  let accepted=false;
  try{
   if(action==='accept_payment'){
    await step('accept_payment',fp('accept_payment'),{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,...scope,reason:reasons.accept_payment});accepted=true;
    if(cents!==p.corrected_amount_cents)await step('correct_payment',fp('correct_payment',`:${cents}`),{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,amount_cents:cents,...scope,reason:'Korekta kwoty przy zatwierdzeniu zgłoszenia w profilu zawodnika'});
   }else if(action==='correct_payment'){
    await step('correct_payment',fp('correct_payment',`:${cents}`),{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,amount_cents:cents,...scope,reason:reasons.correct_payment});
   }else{
    await step(action,fp(action),{payment_id:p.id,...(action==='reject_payment'?{}:{expected_amount_cents:p.corrected_amount_cents}),...scope,reason:reasons[action]});
   }
   setTyped(t=>{const {[p.id]:_,...rest}=t;return rest;});
   setNotice(action==='accept_payment'?`Wpłata zatwierdzona: ${formatCents(cents)}.`:action==='correct_payment'?`Kwota wpłaty poprawiona: ${formatCents(cents)}.`:action==='reject_payment'?'Zgłoszenie odrzucone.':'Wpłata cofnięta.');
   window.dispatchEvent(new Event(financeChangedEvent));
  }catch(e){
   const code=e instanceof AccountError?e.code:'';
   setFormError(accepted?`Zgłoszenie zatwierdzono na zgłoszoną kwotę ${formatCents(p.corrected_amount_cents)}, ale nie udało się zmienić jej na ${formatCents(cents)}. Popraw kwotę w liście wpłat.`:code==='payment_processed'||code==='stale_version'?'Dane zmieniły się na serwerze. Lista została odświeżona.':code==='no_change'?'Kwota jest taka sama jak zapisana.':code==='forbidden'?'Brak uprawnień do decyzji o wpłacie.':'Nie potwierdzono operacji. Sprawdź stan po odświeżeniu przed ponowną próbą.');
  }finally{setDeciding('');setAttempt(n=>n+1);}
 }
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
    {state.phase==='ready'&&state.debt.blocked&&<p className="slm-member-debt-block"><span aria-hidden="true">⛔ </span>Zapisy na płatne mecze są zablokowane (co najmniej dwa zaległe mecze).</p>}
  {state.phase==='ready'&&state.debt.payments.length>0&&<ul className="slm-member-debt-payments" aria-label="Wpłaty zawodnika">{state.debt.payments.map(p=>{const pend=p.status==='pending';return <li key={p.id}>
   <span>{formatCents(p.corrected_amount_cents)} · {pend?'zgłoszona, czeka na decyzję':'zaksięgowana'}</span>
   <label className="slm-member-debt-amount">Kwota (zł)<input inputMode="decimal" value={typed[p.id]??(p.corrected_amount_cents/100).toFixed(2).replace('.',',')} onChange={e=>setTyped(t=>({...t,[p.id]:e.target.value}))} disabled={!!deciding}/></label>
   <span className="slm-member-debt-actions">{pend
    ?<><button type="button" disabled={!!deciding} onClick={()=>{void decide('accept_payment',p);}}>Zatwierdź</button><button type="button" disabled={!!deciding} onClick={()=>{void decide('reject_payment',p);}}>Odrzuć</button></>
    :<><button type="button" disabled={!!deciding} onClick={()=>{void decide('correct_payment',p);}}>Popraw kwotę</button><button type="button" disabled={!!deciding} onClick={()=>{void decide('cancel_payment',p);}}>Cofnij</button></>}</span>
  </li>;})}</ul>}
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
