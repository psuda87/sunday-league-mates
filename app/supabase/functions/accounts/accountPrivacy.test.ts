import {expect,it,vi} from 'vitest';
import {privatePhones,finishDeletion,deletionProof} from './accountPrivacy';
import type {DeletionDependencies,DeletionJob} from './accountPrivacy';
const viewer='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
it('redacts nested legacy/admin contacts and guests; preserves the consent boolean',async()=>{
 const rows={members:[{user_id:other,phone:'private',contact_phone:'private',share_phone:true},{guest_phone:'private'}]};
 const lookup=vi.fn(async()=>({[other]:null}));
 expect(await privatePhones(rows,viewer,lookup)).toEqual({members:[{user_id:other,phone:null,contact_phone:null,share_phone:true},{guest_phone:null}]});
 expect(lookup).toHaveBeenCalledExactlyOnceWith([other]);
});
it('reads current permissions each time, never reuses an earlier disclosure',async()=>{
 const lookup=vi.fn().mockResolvedValueOnce({[other]:'+48000000002'}).mockResolvedValueOnce({[other]:null});
 const row={user_id:other,phone:'stale'};
 expect(await privatePhones(row,viewer,lookup)).toEqual({user_id:other,phone:'+48000000002'});
 expect(await privatePhones(row,viewer,lookup)).toEqual({user_id:other,phone:null});
});
it('anonymous projection neither reads contacts nor returns numbers',async()=>{
 const lookup=vi.fn();expect(await privatePhones({user_id:other,phone:'secret'},null,lookup)).toEqual({user_id:other,phone:null});expect(lookup).not.toHaveBeenCalled();
});
it('never fills candidate or public projection contacts intentionally omitted by SQL',async()=>{
 expect(await privatePhones({user_id:other,contact_phone:null},viewer,async()=>({[other]:'+48000000002'}))).toEqual({user_id:other,contact_phone:null});
});
it('requires a high-entropy, bounded operation proof',()=>{
 for(const body of [{},{operation_id:other,proof:'short'},{operation_id:'foreign/path',proof:'a'.repeat(64)}])expect(()=>deletionProof(body)).toThrow();
});
function fixture(fail?:'photos'|'purge'|'auth'|'complete'|'notify'){
 const events:string[]=[];let phase:DeletionJob['phase']='prepared';let notice=false;
 const d:DeletionDependencies={
  step:vi.fn(async(operation,_proof,step)=>{events.push(step);if(step===fail)throw Error('transient');if(step==='purge')phase='purged';if(step==='complete')phase='complete';if(step==='notice_sent')notice=true;
   return {operation_id:operation,subject_id:phase==='complete'?null:other,phase,completed_at:phase==='complete'?'2026-11-04T20:00:00Z':null,notice_sent:notice};}),
  removePhotos:vi.fn(async()=>{events.push('photos');if(fail==='photos')throw Error('storage failed');}),
  deleteAuth:vi.fn(async()=>{events.push('auth');if(fail==='auth')throw Error('auth failed');}),
  notify:vi.fn(async()=>{events.push('notify');if(fail==='notify')throw Error('smtp failed');}),
 };
 return {d,events};
}
it('orders revocation-dependent cleanup, verified Auth removal, completion and minimal notice',async()=>{
 const f=fixture();expect(await finishDeletion(viewer,'a'.repeat(64),f.d)).toEqual({deleted:true,operation_id:viewer});
 expect(f.events).toEqual(['claim','photos','purge','auth','complete','notify','notice_sent','release']);
 expect(f.d.notify).toHaveBeenCalledExactlyOnceWith(viewer,'2026-11-04T20:00:00Z');
});
it.each(['photos','purge','auth','complete'] as const)('never acknowledges success when %s fails',async fail=>{
 const f=fixture(fail);await expect(finishDeletion(viewer,'a'.repeat(64),f.d)).rejects.toThrow();expect(f.d.notify).not.toHaveBeenCalled();expect(f.events.at(-1)).toBe('release');
});
it('notification outage does not undo deletion or mark notice as sent; retry skips completed destructive stages',async()=>{
 const f=fixture('notify');expect(await finishDeletion(viewer,'a'.repeat(64),f.d)).toMatchObject({deleted:true});
 expect(f.events).not.toContain('notice_sent');f.events.length=0;
 await finishDeletion(viewer,'a'.repeat(64),f.d);
 expect(f.events).toEqual(['claim','notify','release']);
});
it('does not release another workers lease when claim was denied',async()=>{
 const f=fixture();vi.mocked(f.d.step).mockRejectedValueOnce(Error('busy'));
 await expect(finishDeletion(viewer,null,f.d)).rejects.toThrow('busy');expect(f.d.step).toHaveBeenCalledOnce();
});
