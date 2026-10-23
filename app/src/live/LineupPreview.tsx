import { useState } from 'react';
import FootballPitch from '../ui/FootballPitch';
import type { PitchPerson } from '../ui/FootballPitch';
import type { Participant } from '../events/model';
export type LiveEntry=Omit<Participant,'status'>&{status:'registered'|'reserve'|'withdrawn'};

export default function LineupPreview({entries,cancelled,onPlayer}:{entries:LiveEntry[];cancelled:boolean;onPlayer:(id:string)=>void}) {
  const [assignment,setAssignment]=useState<Record<string,'a'|'b'|''>>({});
  const registered=entries.filter(p=>p.status==='registered');
  const person=(entry:LiveEntry):PitchPerson=>({id:entry.id,playerId:entry.member_id,name:entry.display_name,shortName:entry.member_id?undefined:entry.display_name,guest:!entry.member_id});
  const a=registered.filter(e=>assignment[e.id]==='a').map(person),b=registered.filter(e=>assignment[e.id]==='b').map(person);
  return <section className="slm-premium-teams" aria-label="Lokalny podgląd składów">
    <p className="slm-teams-disclaimer">Lokalny podgląd · bez losowania i zapisu na serwerze. Po opuszczeniu meczu podział znika.</p>
    {cancelled?<div className="slm-teams-empty"><h3>Mecz anulowany</h3><p>Składy niedostępne dla odwołanego meczu.</p></div>:<>
      <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{b.length}</strong></span></div>
      <p className="slm-teams-hint">Przypisz osoby ręcznie poniżej. Rezerwa pozostaje poza boiskiem. Numery koszulek nie są jeszcze dostępne; „—” oznacza brak numeru, G — gościa.</p>
      <FootballPitch a={a} b={b} onPlayer={p=>onPlayer(p.id)}/>
      {!registered.length&&<p role="status" className="slm-teams-empty">Boisko czeka na zapisanych uczestników.</p>}
      {!!registered.length&&<details className="slm-local-lineup-editor"><summary>Ustaw lokalny podział · poza boiskiem: {registered.length-a.length-b.length}</summary>
        <p>To ręczny szkic na tym urządzeniu, a nie zatwierdzone składy meczu.</p>
        {registered.map(p=><label key={p.id}>{p.display_name}<select aria-label={`Drużyna dla ${p.display_name}`} value={assignment[p.id]??''} onChange={event=>{const side=event.target.value as 'a'|'b'|'';setAssignment(previous=>({...previous,[p.id]:side}));}}><option value="">Poza podziałem</option><option value="a">Drużyna A</option><option value="b">Drużyna B</option></select></label>)}
        <div className="slm-team-actions"><button type="button" onClick={()=>setAssignment({})}>Wyczyść lokalny podział</button></div>
      </details>}
    </>}
  </section>;
}
