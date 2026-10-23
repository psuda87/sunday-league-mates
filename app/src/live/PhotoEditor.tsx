import { useEffect, useRef, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import { prepareProfilePhoto } from './photoFile';
interface Photo {image_data_url:string|null;revision:string|null;cleanup_pending?:boolean}

export default function PhotoEditor({manager,userId,onPhoto,onChoose,pendingFile,onConsumed}:{manager:SessionManager;userId:string;onPhoto:(source:string|null)=>void;onChoose?:()=>void;pendingFile?:File;onConsumed?:()=>void}) {
  const [photo,setPhoto]=useState<Photo>({image_data_url:null,revision:null});
  const [preview,setPreview]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const input=useRef<HTMLInputElement>(null),alive=useRef(false),flight=useRef(false);
  function apply(result:Photo){setPhoto(result);onPhoto(result.image_data_url);setNotice(result.cleanup_pending?'Usuwanie poprzedniego pliku nie zostało zakończone. Ponów wczytanie zdjęcia.':'');}
  useEffect(()=>{
    let active=true;alive.current=true;setLoading(true);setError('');
    manager.call<Photo>('profile_photo_get').then(result=>{if(active){setPhoto(result);onPhoto(result.image_data_url??null);setNotice(result.cleanup_pending?'Ponów wczytanie, aby dokończyć usuwanie poprzedniego pliku.':'');}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Nie można wczytać zdjęcia.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;alive.current=false;};
  },[manager,userId,onPhoto]);
  useEffect(()=>{
    if(!pendingFile||loading)return;
    let active=true;setBusy(true);setError('');
    prepareProfilePhoto(pendingFile).then(source=>{if(active)setPreview(source);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Nie można odczytać zdjęcia.');})
      .finally(()=>{if(active){setBusy(false);onConsumed?.();}});
    return()=>{active=false;};
  },[pendingFile,loading,onConsumed]);
  async function work(task:()=>Promise<void>){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{await task();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Operacja zdjęcia nie powiodła się.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
  return <section className="slm-photo-editor" aria-label="Zdjęcie profilowe" aria-busy={busy||loading}>
    {(busy||loading)&&<p role="status"><IonSpinner/> Przygotowanie zdjęcia…</p>}
    {error&&<p className="slm-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!onChoose&&<input ref={input} className="slm-photo-input" aria-label="Wybierz zdjęcie z galerii" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||loading} onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      void work(async()=>{const source=await prepareProfilePhoto(file);if(alive.current)setPreview(source);});
    }}/>}
    <div className="slm-actions"><IonButton disabled={busy||loading} onClick={()=>onChoose?onChoose():input.current?.click()}>{photo.image_data_url?'Zmień zdjęcie':'Dodaj zdjęcie'}</IonButton>
      {(error||notice)&&<IonButton disabled={busy||loading} fill="outline" onClick={()=>void work(async()=>{const result=await manager.call<Photo>('profile_photo_get');if(alive.current)apply(result);})}>Wczytaj ponownie</IonButton>}
      {photo.image_data_url&&<IonButton color="danger" fill="outline" disabled={busy||loading} onClick={()=>void work(async()=>{const result=await manager.call<Photo>('profile_photo_delete',{expected_revision:photo.revision});if(alive.current)apply(result);})}>Usuń zdjęcie</IonButton>}
    </div><p className="slm-muted">JPEG, PNG lub WebP · do 2 MiB i 4096 px. Zdjęcie zapisujemy prywatnie, tylko na Twoim koncie.</p>
    <IonModal isOpen={preview!==null} canDismiss={!busy} onDidDismiss={()=>setPreview(null)}>
      <IonHeader><IonToolbar><IonTitle>Podgląd zdjęcia</IonTitle></IonToolbar></IonHeader>
      <IonContent><div className="slm-photo-preview">{preview&&<img src={preview} alt="Podgląd wybranego zdjęcia"/>}
        {error&&<p className="slm-error" role="alert">{error}</p>}
        <div className="slm-actions"><IonButton disabled={busy} onClick={()=>void work(async()=>{const result=await manager.call<Photo>('profile_photo_upload',{image_data_url:preview,expected_revision:photo.revision});if(alive.current){apply(result);setPreview(null);}})}>Zapisz zdjęcie</IonButton>
          <IonButton fill="outline" disabled={busy} onClick={()=>setPreview(null)}>Anuluj</IonButton></div>
      </div></IonContent>
    </IonModal>
  </section>;
}
