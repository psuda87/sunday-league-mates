export type EmailProof={id:string;token:string;kind:'verify'|'recovery'};
export function readEmailCallback(url:URL):EmailProof|null{
 const p=new URLSearchParams(url.hash.slice(1)),id=p.get('id'),token=p.get('token'),kind=p.get('kind');
 if(['id','token','kind'].some(k=>p.getAll(k).length!==1)||url.search||[...p.keys()].some(k=>!['id','token','kind'].includes(k))||!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!token||!/^[0-9a-f]{64}$/.test(token)||!['verify','recovery'].includes(kind??''))return null;
 return{id,token,kind:kind as EmailProof['kind']};
}
