import { useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, FormEvent } from 'react';
import { AvatarPicker, IdentityEditor } from './Identity';
import AppearanceSettings from '../ui/AppearanceSettings';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from './UltimatePlayerCard';
import type { Action, World } from './data';
import { statistics } from './data';
import { useFrozenBack } from '../native/frozenDemoAndroid';
export default function DemoProfile({world,id,onBack,dispatch,personal=false,onPassword,onLogout,liveAuth=false}:{world:World;id:string;onBack?:()=>void;dispatch:Dispatch<Action>;personal?:boolean;onPassword?:()=>void;onLogout?:()=>void;liveAuth?:boolean}) {
  const player=world.players.find(p=>p.id===id)!;
  const heading=useRef<HTMLHeadingElement>(null),field=useId(),errorId=useId();
  const [editing,setEditing]=useState(false),[number,setNumber]=useState(''),[error,setError]=useState('');
  const own=world.userId===id;
  const [editor,setEditor]=useState<'identity'|'portrait'|null>(null);
  const settings=useRef<HTMLDetailsElement>(null);
  const editNumber=()=>{setEditor(null);setNumber(String(player.jerseyNumber??''));setError('');setEditing(true);};
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  const closeEditor=()=>{setEditor(null);requestAnimationFrame(()=>heading.current?.focus());};
  // FROZEN_ANDROID_BEGIN
  useFrozenBack(()=>{
    if(editing){setEditing(false);return true;}
    if(editor){closeEditor();return true;}
    if(settings.current?.open){settings.current.open=false;return true;}
    return false;
  },()=>heading.current,30);
  // FROZEN_ANDROID_END
  const stats=statistics(world,id);
  function save(event:FormEvent) {
    event.preventDefault();
    if(!own)return;
    if(!/^[0-9]{1,2}$/.test(number.trim())){setError('Wpisz pełny numer od 0 do 99.');return;}
    dispatch({type:'jersey',playerId:id,number:Number(number.trim())});setEditing(false);
  }
  return <div className="slm-players-screen slm-ultimate-profile"><MatchHeader title={personal?"Mój profil":"Zawodnicy"} backLabel="Wróć do poprzedniego widoku" onBack={onBack}/><p className="slm-players-demo">Dane przykładowe · fikcyjne portrety i statystyki</p>
    <UltimatePlayerCard key={id} name={player.name} portrait={player.portrait} jerseyNumber={player.jerseyNumber} headingRef={heading} onEditNumber={own?editNumber:undefined}/>
    {editing&&own&&<form className="slm-number-form" onSubmit={save} noValidate aria-label="Edycja numeru demonstracyjnego">
      <label htmlFor={field}>Twój numer koszulki · demo (0–99)</label>
      <input id={field} autoFocus inputMode="numeric" autoComplete="off" value={number} onChange={e=>setNumber(e.target.value)} aria-invalid={!!error} aria-describedby={error?errorId:undefined}/>
      {error&&<p id={errorId} role="alert">{error}</p>}
      <div><button type="submit">Zapisz numer</button><button type="button" onClick={()=>setEditing(false)}>Anuluj</button></div>
    </form>}
    <section className="slm-player-stats slm-ultimate-summary" aria-label="Cztery podstawowe statystyki demonstracyjne"><dl className="slm-ultimate-stats">{[[stats.played,'Mecze'],[player.demoTotals.goals,'Bramki'],[player.demoTotals.assists,'Asysty'],[player.demoTotals.mvp,'MVP']].map(([value,label])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    {personal&&own&&<div className="slm-my-identity">
      <div className="slm-identity-actions slm-my-actions"><button type="button" aria-expanded={editor==='identity'} onClick={()=>{setEditing(false);setEditor(editor==='identity'?null:'identity');}}>Edytuj profil</button><button type="button" aria-expanded={editor==='portrait'} onClick={()=>{setEditing(false);setEditor(editor==='portrait'?null:'portrait');}}>Zmień zdjęcie</button><button type="button" onClick={()=>{if(settings.current){settings.current.open=!settings.current.open;if(settings.current.open)settings.current.scrollIntoView?.({block:'start',behavior:'smooth'});}}}>Ustawienia</button></div>
      {editor==='identity'&&<IdentityEditor key={id} player={player} dispatch={dispatch} onClose={closeEditor} onNumber={editNumber}/>}
      {editor==='portrait'&&<AvatarPicker key={id} player={player} dispatch={dispatch} onClose={closeEditor}/>}
      <details ref={settings} className="slm-identity-settings"><summary>Ustawienia aplikacji i konta</summary><AppearanceSettings enablePalettes/><section className="slm-identity-account"><h2>Konto</h2><ul>{['Dane konta','Powiadomienia'].map(label=><li key={label}><span>{label}</span><small>Niedostępne w demo</small></li>)}</ul>{onPassword&&<button type="button" onClick={onPassword}>{liveAuth?'Zmiana hasła':'Zmiana hasła · symulator'}</button>}{onLogout&&<button type="button" onClick={onLogout}>{liveAuth?'Wyloguj':'Wyloguj · symulator'}</button>}<p>{liveAuth?'Logowanie i hasło: Supabase. Pozostałe dane i operacje są demonstracyjne.':'Demo nie ma prawdziwej sesji. Te operacje nie są wykonywane.'}</p></section></details>
    </div>}
  </div>;
}
