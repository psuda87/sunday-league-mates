import { canViewEventProfile, eventAccess } from './eventAccess';
import { membership } from './groups';
import { DemoAvatar } from './Identity';
import { useId, useState } from 'react';
import type { Dispatch, FormEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { calendarOutline, peopleOutline, walletOutline, timeOutline } from 'ionicons/icons';
import type { Action, Entry, Game, World } from './data';
import { demoFinance, parseDemoMoney, paymentStatus, personName } from './data';
const money=(cents:number)=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(cents/100);
export default function DemoFinance({world,game,dispatch,onPlayer}:{world:World;game:Game;dispatch:Dispatch<Action>;onPlayer:(id:string)=>void}) {
 const view=demoFinance(world,game),id=useId(),errorId=useId();
 const [editing,setEditing]=useState<string|null>(null),[amount,setAmount]=useState(''),[error,setError]=useState('');
 const name=(entry:Entry)=>entry.playerId&&canViewEventProfile(world,game,entry.playerId)?<button type="button" className="slm-demo-person" onClick={()=>onPlayer(entry.playerId!)}>{personName(world,entry)}</button>:<span>{personName(world,entry)}<small>Gość bez profilu</small></span>;
 const share=view.rows.find(row=>row.entry.id===editing);
 function save(event:FormEvent) {
  event.preventDefault();if(!view.admin||!share)return;
  const cents=parseDemoMoney(amount);if(cents===null){setError('Wpisz kwotę od 0 do 1 000 000 zł, maksymalnie 2 cyfry po przecinku.');return;}
  dispatch({type:'payment_set',gameId:game.id,entryId:share.entry.id,cents});setEditing(null);
 }
 const perPerson=!view.shares?'—':view.shares.min===view.shares.max?money(view.shares.min):`${money(view.shares.min)}–${money(view.shares.max)}`;
 const tiles=[{label:'Koszt meczu',value:money(game.costCents),icon:calendarOutline},{label:'Na osobę',value:perPerson,icon:peopleOutline},{label:view.admin?'Wpłacono':'Wpłacono · Twoje',value:money(view.paid),icon:walletOutline},{label:view.admin?'Pozostało':'Pozostało · Twoje',value:money(view.remaining),icon:timeOutline}];
 if(eventAccess(world,game)==='none')return <p role="status">Rozliczenie niedostępne.</p>;
 return <section className="slm-demo-settlement slm-finance" aria-label="Demonstracyjne rozliczenie meczu">
  <p className="slm-finance-disclaimer">Symulacja finansowa · fikcyjne wpłaty</p>
  {membership(world,game.groupId)&&<div className="slm-finance-role" role="group" aria-label="Demonstracyjna rola finansowa">{(['player','admin'] as const).map(role=><button type="button" key={role} aria-pressed={world.financeRole===role} onClick={()=>{dispatch({type:'finance_role',role});setEditing(null);setError('');}}>{role==='admin'?'Administrator demo':'Zawodnik'}</button>)}</div>}
  <p className="slm-finance-scope">{view.admin?'Podgląd całego meczu. Tryb testowy, bez prawdziwych uprawnień.':'Widzisz tylko własne rozliczenie, w tym zobowiązania za zaproszonych gości. Koszt meczu i udział są informacją o wydarzeniu.'}</p>
  {game.status==='cancelled'?<div className="slm-finance-empty"><h3>Mecz anulowany</h3><p>Mecz anulowany — brak należności.</p></div>:<>
   <dl className="slm-finance-tiles">{tiles.map(tile=><div key={tile.label}><dt><IonIcon icon={tile.icon} aria-hidden="true"/>{tile.label}</dt><dd>{tile.value}</dd></div>)}</dl>
   <div className="slm-finance-progress"><div><span>{view.admin?'Pokrycie kosztu meczu':'Pokrycie Twoich udziałów'}</span><strong>{view.percent}%</strong></div><div className="slm-finance-track" role="progressbar" aria-label={view.admin?'Postęp wpłat meczu':'Postęp własnych wpłat'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.percent} aria-valuetext={`${view.percent}%, ${money(view.paid)} z ${money(view.due)}`}><span style={{width:`${view.percent}%`}}/></div><small>{money(view.paid)} z {money(view.due)} · {game.status==='completed'?'mecz zakończony':'wstępny podział'}</small></div>
   {view.overpaid>0&&<p className="slm-finance-surplus">↑ Nadpłata: <strong>{money(view.overpaid)}</strong> · demo</p>}
   <div className="slm-finance-list-heading"><h3>{view.admin?'Udziały uczestników':'Twoje udziały'}</h3><span>{view.rows.length}</span></div>
   {!view.rows.length&&<p className="slm-finance-empty">{view.admin?'Brak uczestników do podziału.':'Nie masz pozycji do rozliczenia w tym meczu. Cudze szczegóły są ukryte.'}</p>}
   <ul className="slm-demo-finance-list slm-finance-rows">{view.rows.map(({entry,due})=>{const status=paymentStatus(due,entry.paidCents);return <li key={entry.id} data-entry={entry.id}><div className="slm-finance-person"><span className="slm-finance-avatar" aria-hidden="true">{entry.playerId?<DemoAvatar player={world.players.find(p=>p.id===entry.playerId)!}/>:personName(world,entry).split(' ').slice(0,2).map(s=>s[0]).join('')}</span><div>{name(entry)}{entry.inviterId&&<small>Gość · {entry.inviterId===world.userId?'Twoje zobowiązanie':eventAccess(world,game)==='full'?`płaci ${world.players.find(p=>p.id===entry.inviterId)?.name}`:'rozlicza zapraszający'}</small>}</div><span className="slm-finance-status" data-state={status}>{status==='Opłacono'?'✓':status==='Nadpłata'?'↑':status==='Częściowo'?'◐':'○'} {status}</span></div>
    <dl className="slm-finance-row-amounts"><div><dt>Należne</dt><dd>{money(due)}</dd></div><div><dt>Wpłacone</dt><dd>{money(entry.paidCents)}</dd></div></dl>
    {view.admin&&<details className="slm-finance-row-tools"><summary>Zmień wpłatę · demo</summary><div><button type="button" onClick={()=>dispatch({type:'pay',gameId:game.id,entryId:entry.id})}>Oznacz jako opłacone</button><button type="button" onClick={()=>dispatch({type:'payment_set',gameId:game.id,entryId:entry.id,cents:0})}>Oznacz jako nieopłacone</button><button type="button" onClick={()=>{setEditing(entry.id);setAmount((entry.paidCents/100).toFixed(2).replace('.',','));setError('');}}>Wprowadź kwotę</button></div></details>}
    {view.admin&&share&&share.entry.id===entry.id&&<form className="slm-finance-form" onSubmit={save} noValidate aria-label="Demonstracyjna edycja wpłaty"><h3>Wpłata · {personName(world,share.entry)}</h3><label htmlFor={id}>Kwota zaksięgowana w demo (zł)</label><input id={id} inputMode="decimal" autoFocus autoComplete="off" value={amount} onChange={e=>setAmount(e.target.value)} aria-invalid={!!error} aria-describedby={error?errorId:undefined}/>{error&&<p id={errorId} role="alert">{error}</p>}<p>Ustawia łączną fikcyjną wpłatę dla tej pozycji. Nie wykonuje przelewu.</p><div><button type="submit">Zapisz kwotę demo</button><button type="button" onClick={()=>setEditing(null)}>Anuluj</button></div></form>}
   </li>;})}</ul>

   {view.retained.length>0&&<section className="slm-finance-retained"><h3>Wpłaty poza aktywnymi udziałami</h3>{view.retained.map(entry=><p key={entry.id}>{name(entry)} <strong>{money(entry.paidCents)}</strong></p>)}<p>Uwzględnione w sumie wpłat, bez automatycznego przypisania do innych pozycji. Usunięcie wpisu nie usuwa wpłaty. Bez księgowania FIFO.</p></section>}
   <p className="slm-finance-note">Kwoty w groszach, reszty rozdzielane według stałego porządku wpisów. Za gościa odpowiada zapraszający. Żadna akcja nie zmienia prawdziwych finansów.</p>
  </>}
 </section>;
}
