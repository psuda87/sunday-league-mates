import { jpegDimensions, photoMaxBytes } from '../_shared/profilePhoto.ts';
interface Env {url:string;service:string}
interface Metadata {object_path:string|null;revision:string;cleanup_path:string|null}
export class PhotoError extends Error { constructor(public status:number,public code:string,message:string){super(message);} }
const bucket='slm-profile-photos';
const validJpeg=(bytes:Uint8Array)=>{const size=jpegDimensions(bytes);return !!size&&Math.max(size.width,size.height)<=4096;};
const unavailable=()=>new PhotoError(503,'photo_unavailable','Zdjęcie jest chwilowo niedostępne. Spróbuj ponownie.');
export async function profilePhoto(env:Env,ctx:{id:string;sid:string},action:string,body:Record<string,unknown>) {
  if(['user_id','object_path','path'].some(key=>Object.hasOwn(body,key)))throw new PhotoError(400,'invalid_input','Nieprawidłowe dane zdjęcia.');
  async function request(path:string,method='GET',data?:BodyInit,contentType?:string) {
    try{return await fetch(env.url+path,{method,headers:{apikey:env.service,Authorization:`Bearer ${env.service}`,
      ...(contentType?{'Content-Type':contentType}:{}),Prefer:'return=representation'},body:data,signal:AbortSignal.timeout(15000)});}
    catch{throw unavailable();}
  }
  async function metadata():Promise<Metadata|null> {
    const r=await request('/rest/v1/slm_profile_photos?user_id=eq.'+ctx.id+'&select=object_path,revision,cleanup_path');
    if(!r.ok)throw unavailable();return (await r.json())[0]??null;
  }
  async function remove(path:string) {
    if(!path.startsWith(ctx.id+'/'))throw unavailable();
    const r=await request('/storage/v1/object/'+bucket,'DELETE',JSON.stringify({prefixes:[path]}),'application/json');
    if(!r.ok)throw unavailable();
  }
  async function cleanup(meta:Metadata|null) {
    if(!meta?.cleanup_path)return false;
    try{
      await remove(meta.cleanup_path);
      const r=await request('/rest/v1/slm_profile_photos?user_id=eq.'+ctx.id+'&cleanup_path=eq.'+encodeURIComponent(meta.cleanup_path),
        'PATCH',JSON.stringify({cleanup_path:null}),'application/json');
      return !r.ok;
    }catch{return true;}
  }
  let meta=await metadata();
  const cleanupPending=await cleanup(meta);
  if(!cleanupPending&&meta?.cleanup_path)meta={...meta,cleanup_path:null};
  if(action==='profile_photo_get') {
    if(!meta?.object_path)return {image_data_url:null,revision:meta?.revision??null,cleanup_pending:cleanupPending};
    if(!meta.object_path.startsWith(ctx.id+'/'))throw unavailable();
    const r=await request('/storage/v1/object/authenticated/'+bucket+'/'+meta.object_path);
    if(!r.ok)throw unavailable();
    const data=new Uint8Array(await r.arrayBuffer());
    if(data.length>photoMaxBytes||!validJpeg(data))throw unavailable();
    let binary='';for(let offset=0;offset<data.length;offset+=8192)binary+=String.fromCharCode(...data.subarray(offset,offset+8192));
    return {image_data_url:'data:image/jpeg;base64,'+btoa(binary),revision:meta.revision,cleanup_pending:cleanupPending};
  }
  if(cleanupPending)throw new PhotoError(503,'photo_cleanup_required','Nie zakończono usuwania poprzedniego zdjęcia. Ponów wczytanie zdjęcia.');
  const expected=body.expected_revision??null;
  if(expected!==null&&(typeof expected!=='string'||!/^[a-f0-9-]{36}$/.test(expected)))throw new PhotoError(400,'invalid_input','Nieprawidłowa wersja zdjęcia.');
  let path:string|null=null,image:string|null=null;
  if(action==='profile_photo_upload') {
    image=typeof body.image_data_url==='string'?body.image_data_url:null;
    if(!image||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new PhotoError(400,'invalid_photo','Wybierz poprawne zdjęcie JPEG, PNG lub WebP.');
    let bytes:Uint8Array;
    try{bytes=Uint8Array.from(atob(image.slice(image.indexOf(',')+1)),char=>char.charCodeAt(0));}catch{throw new PhotoError(400,'invalid_photo','Nieprawidłowy plik zdjęcia.');}
    if(bytes.length>photoMaxBytes||!validJpeg(bytes))throw new PhotoError(400,'invalid_photo','Zdjęcie musi mieć maksymalnie 2 MiB i 4096 × 4096 pikseli.');
    path=ctx.id+'/'+crypto.randomUUID()+'.jpg';
    const r=await request('/storage/v1/object/'+bucket+'/'+path,'POST',bytes as BodyInit,'image/jpeg');
    if(!r.ok)throw unavailable();
  }else if(action!=='profile_photo_delete')throw new PhotoError(400,'invalid_action','Nieprawidłowa operacja zdjęcia.');
  const result=await request('/rest/v1/rpc/slm_profile_photo_commit','POST',JSON.stringify({p_user:ctx.id,p_session:ctx.sid,p_expected:expected,p_path:path}),'application/json');
  if(!result.ok) {
    if(path)await remove(path).catch(()=>{});
    const error=await result.json().catch(()=>null);
    if(error?.message==='session_invalid')throw new PhotoError(401,'session_invalid','Sesja wygasła. Zaloguj się ponownie.');
    if(error?.message==='stale_photo')throw new PhotoError(409,'stale_photo','Zdjęcie zostało zmienione. Wczytaj je ponownie.');
    throw unavailable();
  }
  const saved=await result.json() as Metadata;
  return {image_data_url:image,revision:saved.revision,cleanup_pending:await cleanup(saved)};
}

export async function readAccountBody(request:Request,maxBytes:number) {
  if(Number(request.headers.get('content-length'))>maxBytes)throw new PhotoError(413,'too_large','Za duże żądanie.');
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;
    if(size>maxBytes){await reader.cancel();throw new PhotoError(413,'too_large','Za duże żądanie.');}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(bytes);
}
