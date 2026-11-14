import { usePlayerRating } from '../rating/RatingProvider';
import { useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, FormEvent } from 'react';
import { AvatarPicker, IdentityEditor } from './Identity';
import {AccountDeletion} from '../profile/PhoneEditor';
import AppearanceSettings from '../ui/AppearanceSettings';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from './UltimatePlayerCard';
import type { PersonalProfileBinding } from '../ui/personalProfile';
import type { Action, World } from './data';
import { statistics } from './data';
import { useFrozenBack } from '../native/frozenDemoAndroid';
export default function DemoProfile({world,id,onBack,dispatch,personal=false,onPassword,onLogout,liveAuth=false,personalProfile}:{world:World;id:string;onBack?:()=>void;dispatch:Dispatch<Action>;personal?:boolean;onPassword?:()=>void;onLogout?:()=>void;liveAuth?:boolean;personalProfile?:PersonalProfileBinding}) {
  const player=world.players.find(p=>p.id===id)!;
  const live=personal?personalProfile:undefined,profile=live?.profile;
  const heading=useRef<HTMLHeadingElement>(null),field=useId(),errorId=useId();
  const [editing,setEditing]=useState(false),[number,setNumber]=useState(''),[error,setError]=useState('');
  const own=world.userId===id;
  const [editor,setEditor]=useState<'identity'|'portrait'|null>(null);
  const settings=useRef<HTMLDetailsElement>(null);
  const portraitPanel=useRef<HTMLDivElement>(null);
  const playerCardArea=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(editor!=='portrait')return;
    const frame=requestAnimationFrame(()=>portraitPanel.current?.scrollIntoView({behavior:'smooth',block:'center'}));
    return ()=>cancelAnimationFrame(frame);
  },[editor]);
  const editNumber=()=>{if(live){setEditing(false);setEditor('identity');return;}setEditor(null);setNumber(String((live?profile?.jersey_number:player.jerseyNumber)??''));setError('');setEditing(true);};
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  const closeEditor=()=>{setEditor(null);requestAnimationFrame(()=>heading.current?.focus());};
  const finishPhotoUpload=()=>{
    setEditor(null);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      heading.current?.focus({preventScroll:true});
      playerCardArea.current?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  };
  // FROZEN_ANDROID_BEGIN
  useFrozenBack(()=>{
    if(editing){setEditing(false);return true;}
    if(editor){closeEditor();return true;}
    if(settings.current?.open){settings.current.open=false;return true;}
    return false;
  },()=>heading.current,30);
  // FROZEN_ANDROID_END
  const stats=statistics(world,id);
  const liveStats=usePlayerRating(live?profile?.user_id:undefined)?.stats;
  function save(event:FormEvent) {
    event.preventDefault();
    if(!own)return;
    if(!/^[0-9]{1,2}$/.test(number.trim())){setError('Wpisz pełny numer od 0 do 99.');return;}
    dispatch({type:'jersey',playerId:id,number:Number(number.trim())});setEditing(false);
  }
  return <div className="slm-players-screen slm-ultimate-profile"><MatchHeader title={personal?"Mój profil":"Zawodnicy"} backLabel="Wróć do poprzedniego widoku" onBack={onBack}/><p className="slm-players-demo">{live?live.phase==='loading'?'Wczytywanie profilu…':live.phase==='ready'?(liveStats?'Profil Supabase':'Profil Supabase · statystyki niedostępne'):live.notice:'Dane przykładowe · fikcyjne portrety i statystyki'}</p>
    <div ref={playerCardArea}><UltimatePlayerCard key={id} playerId={live?profile?.user_id:id} name={live?profile?.display_name??'—':player.name} portrait={live?(live.photo?.image?{src:live.photo.image}:undefined):player.portrait} jerseyNumber={live?profile?.jersey_number??undefined:player.jerseyNumber} headingRef={heading} portraitFit={live?'cover':undefined} portraitDescription={live?'Zdjęcie profilowe':undefined} onEditNumber={own&&(!live||live.phase==='ready'&&!!live.saveNumber)?editNumber:undefined}/></div>
    {editing&&own&&!live&&<form className="slm-number-form" onSubmit={save} noValidate aria-label={live?"Edycja własnego numeru koszulki":"Edycja numeru demonstracyjnego"}>
      <label htmlFor={field}>{live?'Twój numer koszulki (0–99)':'Twój numer koszulki · demo (0–99)'}</label>
      <input id={field} autoFocus inputMode="numeric" autoComplete="off" value={number} onChange={e=>setNumber(e.target.value)} aria-invalid={!!error} aria-describedby={error?errorId:undefined}/>
      {error&&<p id={errorId} role="alert">{error}</p>}
      <div><button type="submit">Zapisz numer</button><button type="button" onClick={()=>setEditing(false)}>Anuluj</button></div>
    </form>}
    <section className="slm-player-stats slm-ultimate-summary" aria-label={live?"Statystyki zawodnika · niedostępne":"Cztery podstawowe statystyki demonstracyjne"}><dl className="slm-ultimate-stats">{[[stats.played,'Mecze'],[player.demoTotals.goals,'Bramki'],[player.demoTotals.assists,'Asysty'],[player.demoTotals.mvp,'MVP']].map(([value,label],index)=><div key={label}><dt>{label}</dt><dd>{live?(liveStats?[liveStats.played,liveStats.goals,liveStats.assists,liveStats.mvp][index]:'—'):value}</dd></div>)}</dl></section>
    {personal&&own&&<div className="slm-my-identity">
      <div className="slm-identity-actions slm-my-actions"><button type="button" disabled={!!live&&(live.phase==='loading'||live.saving)} aria-expanded={editor==='identity'} onClick={()=>{if(live&&live.phase!=='ready'){live.reload();return;}setEditing(false);setEditor(editor==='identity'?null:'identity');}}>{live&&live.phase!=='ready'?'Ponów odczyt profilu':'Edytuj profil'}</button><button type="button" disabled={!!live&&(live.phase!=='ready'||live.photo?.saving||!live.photo)} aria-expanded={editor==='portrait'} onClick={()=>{setEditing(false);if(live?.photo?.phase==='error')live.photo.reload();setEditor(editor==='portrait'?null:'portrait');}}>Zmień zdjęcie</button><button type="button" onClick={()=>{if(settings.current){settings.current.open=!settings.current.open;if(settings.current.open)settings.current.scrollIntoView?.({block:'start',behavior:'smooth'});}}}>Ustawienia</button></div>
      {editor==='identity'&&(!live||live.phase==='ready')&&<IdentityEditor key={'identity:'+(profile?.user_id??id)} personalProfile={live} player={player} dispatch={dispatch} onClose={closeEditor} onNumber={editNumber}/>}
      {editor==='portrait'&&<div ref={portraitPanel}><AvatarPicker key={'portrait:'+(profile?.user_id??id)+(live?.photo?.image??'')} personalPhoto={live?.photo} player={player} dispatch={dispatch} onClose={closeEditor} onSaved={finishPhotoUpload}/></div>}
      <details ref={settings} className="slm-identity-settings"><summary>Ustawienia aplikacji i konta</summary><AppearanceSettings enablePalettes/><section className="slm-identity-account"><h2>Konto</h2><ul>{['Dane konta','Powiadomienia'].map(label=><li key={label}><span>{label}</span><small>{live&&label==='Dane konta'?profile?`Login: ${profile.login} · Telefon: ${profile.phone||'brak'}`:'Profil niedostępny':live?'W przygotowaniu':'Niedostępne w demo'}</small></li>)}</ul>{onPassword&&<button type="button" onClick={onPassword}>{liveAuth?'Zmiana hasła':'Zmiana hasła · symulator'}</button>}{live?.deleteAccount&&<AccountDeletion binding={live}/>} {onLogout&&<button type="button" onClick={onLogout}>{liveAuth?'Wyloguj':'Wyloguj · symulator'}</button>}<p>{live?'Profil, logowanie i hasło są zapisane na Twoim koncie. Mecze i członkostwo znajdziesz w odpowiednich zakładkach.':liveAuth?'Logowanie i hasło: Supabase. Pozostałe dane i operacje są demonstracyjne.':'Demo nie ma prawdziwej sesji. Te operacje nie są wykonywane.'}</p></section></details>
      {live?.payments}
    </div>}
  </div>;
}
