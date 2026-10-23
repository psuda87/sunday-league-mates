import { IonButton } from '@ionic/react';
import ParticipantGroup from '../ui/ParticipantGroup';
import ParticipantRow from '../ui/ParticipantRow';
import type { LiveEntry } from './LineupPreview';

export default function MatchRoster({entries,userId,canManage,registrationOpen,fullAccess,busy,approved,onPlayer,onAction}:{
  entries:LiveEntry[];userId:string;canManage:boolean;registrationOpen:boolean;fullAccess:boolean;busy:boolean;approved:boolean;
  onPlayer:(id:string)=>void;onAction:(action:string,values:Record<string,unknown>)=>void;
}) {
  const groups=[
    {title:'Zapisani',rows:entries.filter(p=>p.status==='registered'&&!!p.member_id),preview:5},
    {title:'Goście',rows:entries.filter(p=>p.status==='registered'&&!p.member_id)},
    {title:'Rezerwa',rows:entries.filter(p=>p.status==='reserve')},
    {title:'Własne rezygnacje / historia',rows:entries.filter(p=>p.status==='withdrawn')},
  ];
  return <section className="slm-live-roster" aria-label="Uczestnicy meczu">{groups.map(group=><ParticipantGroup key={group.title} title={group.title} emptyText="Brak wpisów." previewLimit={group.preview} description={group.title==='Rezerwa'?'Bez automatycznego awansu.':undefined}>{group.rows.map(p=>{
    const canWithdraw=(p.responsible_user_id===userId||canManage)&&registrationOpen&&p.status!=='withdrawn';
    const canMove=!p.member_id&&p.status==='reserve'&&(p.responsible_user_id===userId||canManage)&&registrationOpen&&fullAccess;
    const canAttendance=canManage&&p.status==='registered';
    return <ParticipantRow key={p.id} avatar={p.display_name.trim().split(/\s+/u).slice(0,2).map(s=>Array.from(s)[0]).join('')}
      name={p.member_id&&fullAccess?<button type="button" className="slm-person-link" onClick={()=>onPlayer(p.id)}>{p.display_name}</button>:<strong>{p.display_name}</strong>}
      description={<><small>{p.member_id?'Zawodnik':`Gość · odpowiedzialny: ${p.responsible_name}`}{p.absent?' · Nieobecny':''}</small>{p.contact_phone&&<a className="slm-roster-call" href={'tel:'+p.contact_phone}>Zadzwoń</a>}</>}
      actions={(canWithdraw||canMove||canAttendance)&&<details className="slm-person-actions"><summary aria-label={`Opcje uczestnika: ${p.display_name}`}><span aria-hidden="true">•••</span></summary><div role="group" aria-label={`Akcje: ${p.display_name}`}>
        {canWithdraw&&<IonButton disabled={busy} fill="clear" onClick={()=>onAction('withdraw',{participant_id:p.id})}>Usuń udział</IonButton>}
        {canMove&&<IonButton disabled={busy} fill="clear" onClick={()=>onAction('move_guest',{participant_id:p.id})}>Zapisz gościa na mecz</IonButton>}
        {canAttendance&&<IonButton disabled={busy} fill="clear" onClick={()=>{const reason=approved?window.prompt('Powód korekty obecności'):'';if(reason!==null&&(!approved||reason.trim()))onAction('attendance',{participant_id:p.id,absent:!p.absent,reason});}}>{p.absent?'Oznacz obecność':'Oznacz nieobecność'}</IonButton>}
      </div></details>}/>;
  })}</ParticipantGroup>)}</section>;
}
