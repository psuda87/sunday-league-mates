import { useState } from 'react';
import PremiumPitch from '../ui/PremiumPitch';
import type { MatchEntry } from './premiumContracts';

// Real authorized roster in; only explicit, manual assignments live in RAM.
// No demo World/reducer, randomization, persistence or server write.
export default function PremiumTeams({eventId,participants,cancelled}:{eventId:string;participants:MatchEntry[];cancelled:boolean}){
 const [assignment,setAssignment]=useState<Record<string,'a'|'b'>>({});
 const [swap,setSwap]=useState(false),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
 const eligible=participants.filter(p=>p.status==='registered');
 const teams={a:eligible.filter(p=>assignment[p.id]==='a'),b:eligible.filter(p=>assignment[p.id]==='b')};
 const selectedEntry=eligible.find(p=>p.id===selected),selectedSide=selectedEntry?assignment[selectedEntry.id]:undefined;
 function choose(p:MatchEntry,side:'a'|'b'){
  if(!swap){setNotice(p.display_name+(p.member_id?' · zawodnik':' · gość')+' — dane z listy uczestników. Karta profilu nie jest dostępna w tym DTO.');return;}
  if(selected===p.id){setSelected(null);return;}
  if(selectedEntry&&selectedSide&&selectedSide!==side){
   setAssignment(previous=>({...previous,[p.id]:selectedSide,[selectedEntry.id]:side}));setSelected(null);setNotice('Zamieniono wyłącznie w lokalnym podglądzie.');
  }else{setSelected(p.id);setNotice('Wybierz osobę z przeciwnej drużyny.');}
 }
 return <section className="slm-demo-teams slm-live-teams" aria-label="Lokalny podgląd składów" data-event-id={eventId}>
  <p className="slm-teams-disclaimer">Lokalny podgląd · bez zapisu na serwerze</p>
  <p className="slm-teams-hint">Lista pochodzi z rzeczywistych zapisów. Przypisz osoby ręcznie do A lub B. Brak zapisanych składów i zamian w API. Numery koszulek nie są udostępniane przez ten kontrakt.</p>
  {cancelled?<div className="slm-teams-empty"><h3>Mecz anulowany</h3><p>Podgląd ustawienia niedostępny.</p></div>:<>
   <details className="slm-lineup-roster" open>
    <summary>Rzeczywiści uczestnicy · ustaw drużyny ({eligible.length})</summary>
    {!eligible.length&&<p>Brak zapisanych uczestników. Rezerwa i wycofani pozostają poza boiskiem.</p>}
    {eligible.map(p=><label key={p.id}>{p.display_name}{!p.member_id?' · gość':''}<select aria-label={'Drużyna: '+p.display_name} value={assignment[p.id]??''} onChange={e=>{const side=e.target.value;setAssignment(previous=>{const next={...previous};if(side==='a'||side==='b')next[p.id]=side;else delete next[p.id];return next;});setSelected(null);}}><option value="">Poza podziałem</option><option value="a">Drużyna A</option><option value="b">Drużyna B</option></select></label>)}
   </details>
   <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{teams.a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{teams.b.length}</strong></span></div>
   <div className="slm-team-actions"><button type="button" disabled={!teams.a.length||!teams.b.length} aria-pressed={swap} onClick={()=>{setSwap(!swap);setSelected(null);setNotice('');}}>{swap?'Zakończ zamiany':'Zamień zawodników'}</button><button type="button" onClick={()=>{setAssignment({});setSwap(false);setSelected(null);setNotice('Wyczyszczono lokalny podgląd.');}}>Wyczyść podgląd</button></div>
   <p className="slm-teams-hint" role="status">{notice||(swap?'Wybierz po jednej osobie z obu drużyn.':'Dotknij znacznika, aby sprawdzić uczestnika. Ustawienie znika po opuszczeniu meczu.')}</p>
   <PremiumPitch a={teams.a} b={teams.b} renderPlayer={(p,side)=><li key={p.id} data-entry={p.id}><button type="button" className="slm-pitch-player" aria-label={(swap?'Wybierz do zamiany: ':'Uczestnik: ')+p.display_name} aria-pressed={swap?selected===p.id:undefined} onClick={()=>choose(p,side)}><span className="slm-pitch-token" aria-hidden="true">{p.member_id?'—':'G'}</span><span className="slm-pitch-name">{p.display_name}</span></button></li>}/>
  </>}
 </section>;
}
