import { useEffect,useRef,useState } from 'react';
import type { SessionManager } from './sessionManager';
import type { PersonalPhotoBinding } from '../ui/personalProfile';
import { preparePhoto } from '../profile/preparePhoto';

type Photo={image_data_url:string|null;revision:string|null;cleanup_pending:boolean};
function validate(value:Photo):Photo {
 if(!value||!(value.revision===null||typeof value.revision==='string'&&/^[a-f0-9-]{36}$/.test(value.revision))||
  !(value.image_data_url===null||typeof value.image_data_url==='string'&&value.image_data_url.length<2800000&&/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image_data_url)))throw Error('photo_contract_invalid');
 return value;
}
export function useOwnPhoto(manager:SessionManager,userId:string|null,selection?:{begin:()=>void;end:()=>void}):PersonalPhotoBinding {
 const [version,setVersion]=useState(0),[saving,setSaving]=useState(false);
 const [state,setState]=useState<{owner:string|null;phase:PersonalPhotoBinding['phase'];photo:Photo|null;notice:string}>({owner:null,phase:'loading',photo:null,notice:''});
 const generation=useRef(0),flight=useRef(false);
 useEffect(()=>{
  const ticket=++generation.current;flight.current=false;setSaving(false);
  setState({owner:userId,phase:'loading',photo:null,notice:''});
  if(userId)void manager.call<Photo>('profile_photo_get').then(validate).then(photo=>{
   if(ticket===generation.current)setState({owner:userId,phase:'ready',photo,notice:photo.cleanup_pending?'Trwa usuwanie poprzedniego zdjęcia. Ponów odczyt.':''});
  }).catch(()=>{if(ticket===generation.current)setState({owner:userId,phase:'error',photo:null,notice:'Nie udało się wczytać zdjęcia. Otwórz panel ponownie, aby ponowić odczyt.'});});
  return()=>{generation.current=ticket+1;};
 },[manager,userId,version]);
 const current=state.owner===userId&&userId!==null?state:{owner:userId,phase:'loading' as const,photo:null,notice:''};
 async function write(image:string|null){
  const auth=manager.getSnapshot();
  if(flight.current||current.phase!=='ready'||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
  const ticket=generation.current;flight.current=true;setSaving(true);
  try {
   const values={expected_revision:current.photo?.revision??null,...(image?{image_data_url:image}:{})};
   validate(await manager.call<Photo>(image?'profile_photo_upload':'profile_photo_delete',values));
   const confirmed=validate(await manager.call<Photo>('profile_photo_get'));
   if(ticket!==generation.current)return false;
   if(confirmed.image_data_url!==image)throw Error('photo_readback_mismatch');
   setState({owner:userId,phase:'ready',photo:confirmed,notice:confirmed.cleanup_pending?'Zapisano. Usuwanie starego pliku wymaga ponownego odczytu.':''});return true;
  }catch{
   if(ticket===generation.current)setState({owner:userId,phase:'error',photo:null,notice:'Nie udało się potwierdzić zdjęcia. Otwórz panel ponownie, aby odczytać aktualny stan.'});return false;
  }finally{if(ticket===generation.current){flight.current=false;setSaving(false);}}
 }
 return {phase:current.phase,image:current.photo?.image_data_url??null,notice:current.notice,saving,
  reload:()=>setVersion(v=>v+1),save:image=>write(image),remove:()=>write(null),
  beginSelection:()=>selection?.begin(),endSelection:()=>selection?.end(),
  async prepare(file){
   try {const {blob}=await preparePhoto(file);
   return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Nie udało się przygotować zdjęcia.'));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(blob);});
   }finally{selection?.end();}
  },
 };
}
