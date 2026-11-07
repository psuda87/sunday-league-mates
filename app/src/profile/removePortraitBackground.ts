type Segmenter = {
  onResults: (callback:(result:{segmentationMask:CanvasImageSource})=>void)=>void;
  send:(input:{image:HTMLImageElement|HTMLCanvasElement})=>Promise<void>;
  close:()=>void;
};
declare global { interface Window { SelfieSegmentation?:new(config:{locateFile:(file:string)=>string})=>Segmenter } }
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
let loader:Promise<void>|null=null;
function loadModel():Promise<void>{
  if(window.SelfieSegmentation)return Promise.resolve();
  if(!loader)loader=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=CDN+'selfie_segmentation.js';script.crossOrigin='anonymous';
    script.onload=()=>window.SelfieSegmentation?resolve():reject(Error('Nie udało się uruchomić wycinania tła.'));
    script.onerror=()=>reject(Error('Nie można pobrać modelu wycinania tła. Sprawdź połączenie.'));
    document.head.appendChild(script);
  }).catch(e=>{loader=null;throw e;});
  return loader;
}
export async function removePortraitBackground(image:HTMLCanvasElement):Promise<HTMLCanvasElement>{
  await loadModel();
  const SegmenterClass=window.SelfieSegmentation;
  if(!SegmenterClass)throw Error('Model wycinania tła jest niedostępny.');
  const segmenter=new SegmenterClass({locateFile:file=>CDN+file});
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Brak obsługi przetwarzania zdjęć.');
  try{
    const mask=await new Promise<CanvasImageSource>((resolve,reject)=>{
      segmenter.onResults(result=>resolve(result.segmentationMask));
      segmenter.send({image}).catch(reject);
    });
    ctx.drawImage(image,0,0);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(mask,0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='source-over';
    return canvas;
  }finally{segmenter.close();}
}
