import { useEffect,useState } from 'react';
import PremiumPitch from '../ui/PremiumPitch';
import type { MatchEntry } from './premiumContracts';

// Real authorized roster in; only explicit, manual assignments live in RAM.
// No demo World/reducer, randomization, persistence or server write.
export default function PremiumTeams({eventId,participants,cancelled,canEdit=true}:{eventId:string;participants:MatchEntry[];cancelled:boolean;canEdit?:boolean}){
 const baseline:Record<string,'a'|'b'>={}; // No server lineup exists yet; never fabricate saved metadata.
 const [assignment,setAssignment]=useState<Record<string,'a'|'b'>>({});
 const [swap,setSwap]=useState(false),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
 const eligible=participants.filter(p=>p.status==='registered');
 const rosterKey=eligible.map(p=>p.id).join('|');
 useEffect(()=>{const ids=new Set(rosterKey?rosterKey.split('|'):[]);setAssignment(previous=>{const next=Object.fromEntries(Object.entries(previous).filter(([id])=>ids.has(id)));return Object.keys(next).length===Object.keys(previous).length?previous:next;});setSelected(null);},[rosterKey]);
 const teams={a:eligible.filter(p=>assignment[p.id]==='a'),b:eligible.filter(p=>assignment[p.id]==='b')};
 const selectedEntry=eligible.find(p=>p.id===selected),selectedSide=selectedEntry?assignment[selectedEntry.id]:undefined;
 const unassigned=eligible.filter(p=>!assignment[p.id]);
 const dirty=Object.keys(assignment).length>0;
 function preview(){setAssignment(Object.fromEntries(eligible.map((p,i)=>[p.id,i%2===0?'a':'b'])));setSelected(null);setNotice('Utworzono przykładowy lokalny podgląd z bieżących uczestników, nie wynik losowania ani zapis serwera.');}
 function choose(p:MatchEntry,side:'a'|'b'){
  if(!swap||!canEdit){setNotice(p.display_name+(p.member_id?' · zawodnik':' · gość')+' — dane z listy uczestników. Karta profilu nie jest dostępna w tym DTO.');return;}
  if(selected===p.id){setSelected(null);return;}
  if(selectedEntry&&selectedSide&&selectedSide!==side){
   setAssignment(previous=>({...previous,[p.id]:selectedSide,[selectedEntry.id]:side}));setSelected(null);setNotice('Zamieniono wyłącznie w lokalnym podglądzie.');
  }else{setSelected(p.id);setNotice('Wybierz osobę z przeciwnej drużyny.');}
 }
 return <section className="slm-demo-teams slm-live-teams" aria-label="Lokalny podgląd składów" data-event-id={eventId}>
  <p className="slm-teams-disclaimer">Lokalny podgląd · bez zapisu na serwerze</p>
  <p className="slm-teams-hint">Lista pochodzi z rzeczywistych zapisów. Użyj lokalnego podglądu, następnie zamieniaj osoby bezpośrednio na boisku. Brak zapisanych składów i zamian w API. Numery koszulek nie są udostępniane przez ten kontrakt.</p>
  {cancelled?<div className="slm-teams-empty"><h3>Mecz anulowany</h3><p>Podgląd ustawienia niedostępny.</p></div>:<>
   {!canEdit&&<p>Edycja ustawienia wymaga aktywnego członkostwa w tej grupie.</p>}
   {!dirty&&<div className="slm-teams-empty"><h3>Boisko czeka na drużyny</h3><p>{eligible.length<2?'Potrzeba co najmniej dwóch uczestników.':'Przykładowy podział z rzeczywistej listy — wyłącznie lokalny szkic.'}</p><button type="button" disabled={!canEdit||eligible.length<2} onClick={preview}>Utwórz lokalny podgląd</button></div>}
   <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{teams.a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{teams.b.length}</strong></span></div>
   <div className="slm-team-actions"><button type="button" disabled={!canEdit||!teams.a.length||!teams.b.length} aria-pressed={swap} onClick={()=>{setSwap(!swap);setSelected(null);setNotice('');}}>{swap?'Zakończ zamiany':'Zamień zawodników'}</button><button type="button" disabled={!canEdit||!dirty} onClick={()=>{setAssignment(baseline);setSwap(false);setSelected(null);setNotice('Cofnięto lokalne zmiany. Brak zapisanego składu na serwerze.');}}>Cofnij zmiany</button></div>
   <p className="slm-teams-hint">Ostatnia zmiana: brak zapisanego składu na serwerze.</p><div className="slm-team-actions"><button type="button" disabled>Zapis na serwerze niedostępny</button></div>
   <p className="slm-teams-hint" role="status">{notice||(swap?'Wybierz po jednej osobie z obu drużyn.':'Dotknij znacznika, aby sprawdzić uczestnika. Ustawienie znika po opuszczeniu meczu.')}</p>
   {unassigned.length>0&&<div className="slm-team-unassigned"><h3>Poza podziałem: {unassigned.length}</h3><ul>{unassigned.map(p=><li key={p.id}>{p.display_name}{!p.member_id?' · gość':''}{(['a','b'] as const).map(side=><button type="button" disabled={!canEdit} key={side} aria-label={'Dodaj '+p.display_name+' do drużyny '+side.toUpperCase()} onClick={()=>{setAssignment(previous=>({...previous,[p.id]:side}));setSelected(null);}}>{side.toUpperCase()}</button>)}</li>)}</ul></div>}
   <PremiumPitch a={teams.a} b={teams.b} renderPlayer={(p,side)=><li key={p.id} data-entry={p.id}><button type="button" className="slm-pitch-player" aria-label={(swap?'Wybierz do zamiany: ':'Uczestnik: ')+p.display_name} aria-pressed={swap?selected===p.id:undefined} onClick={()=>choose(p,side)}><span className="slm-pitch-token" aria-hidden="true">{p.member_id?'—':'G'}</span><span className="slm-pitch-name">{p.display_name}</span></button></li>}/>
  </>}
 </section>;
}
