// One server-side contact projection for every accounts response, including legacy
// administrator endpoints. Unknown/guest ownership fails closed.
type Row=Record<string,unknown>;
const phoneField=(k:string)=>['phone','contact_phone','guest_phone','target_phone'].includes(k);
export async function privatePhones(value:unknown,viewer:string|null,lookup:(ids:string[])=>Promise<Record<string,string|null>>):Promise<unknown>{
 const ids=new Set<string>();
 const owner=(r:Row)=>typeof r.user_id==='string'?r.user_id:typeof r.member_id==='string'?r.member_id:null;
 function collect(v:unknown):void{if(Array.isArray(v)){v.forEach(collect);return;}if(!v||typeof v!=='object')return;
 const r=v as Row,id=owner(r);if(id&&/^[a-f0-9-]{36}$/i.test(id)&&Object.keys(r).some(phoneField))ids.add(id);
 Object.values(r).forEach(collect);}
 collect(value);const allowed=viewer&&ids.size?await lookup([...ids]):{};
 function project(v:unknown):unknown{if(Array.isArray(v))return v.map(project);if(!v||typeof v!=='object')return v;
 const r=v as Row,id=owner(r);return Object.fromEntries(Object.entries(r).map(([k,item])=>{
 // An intentionally absent contact (e.g. a candidate projection) must never be
 // filled from the shared-group map merely because the viewer also knows them.
 if(phoneField(k))return [k,item===null||k==='guest_phone'?null:id&&viewer?(allowed[id]??(id===viewer?'':null)):null];
 return [k,project(item)];}));}
 return project(value);
}

export interface DeletionJob {operation_id:string;subject_id:string|null;phase:'prepared'|'purged'|'complete';completed_at:string|null;notice_sent:boolean}
export interface DeletionDependencies {
 step:(operation:string,proof:string|null,step:string,lease:string)=>Promise<DeletionJob>;
 removePhotos:(user:string)=>Promise<void>;
 deleteAuth:(user:string)=>Promise<void>;
 notify:(operation:string,date:string)=>Promise<void>;
}
export function deletionProof(body:Row){
 if(typeof body.operation_id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.operation_id)||typeof body.proof!=='string'||!/^[a-f0-9]{64}$/.test(body.proof))throw Error('deletion_invalid');
 return {operation:body.operation_id,proof:body.proof};
}
export async function finishDeletion(operation:string,proof:string|null,d:DeletionDependencies){
 const lease=crypto.randomUUID();let claimed=false;
 try{
 let job=await d.step(operation,proof,'claim',lease);claimed=true;
 if(job.phase!=='complete'){
 if(!job.subject_id)throw Error('deletion_pending');
 // Sessions are revoked; SQL completion also checks leases of earlier uploads.
 await d.removePhotos(job.subject_id);
 if(job.phase==='prepared')job=await d.step(operation,proof,'purge',lease);
 if(!job.subject_id)throw Error('deletion_pending');
 await d.deleteAuth(job.subject_id);
 job=await d.step(operation,proof,'complete',lease);
 }
 if(job.phase!=='complete'||!job.completed_at)throw Error('deletion_pending');
 if(!job.notice_sent){
 try{await d.notify(operation,job.completed_at);await d.step(operation,proof,'notice_sent',lease);}
 catch{/* Durable job remains pending. Failure never undoes deletion. */}
 }
 return {deleted:true,operation_id:operation};
 }finally{if(claimed)await d.step(operation,proof,'release',lease).catch(()=>undefined);}
}
