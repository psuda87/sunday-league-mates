import { rasterSize } from './imageDimensions';
export const maxPhotoBytes=150_000;
const targetBytes=100_000;
export interface PreparedPhoto {blob:Blob;width:number;height:number;quality:number}
export function parseJerseyNumber(value:string):number {
 const clean=value.trim();if(!/^[0-9]{1,2}$/.test(clean))throw new Error('Wpisz pełny numer od 0 do 99.');
 return Number(clean);
}
export function fitPhoto(width:number,height:number,max=800){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('Nieprawidłowe wymiary zdjęcia.');
 const scale=Math.min(1,max/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
// Unconnected preparation utility: never uploads and never stores an original.
export async function encodePhoto(width:number,height:number,encode:(width:number,height:number,quality:number)=>Promise<Blob|null>):Promise<PreparedPhoto>{
 const seen=new Set<string>();
 let last=fitPhoto(width,height);
 for(const limit of [800,640,512,400]){
  const size=fitPhoto(width,height,limit),key=`${size.width}x${size.height}`;
  if(seen.has(key))continue;seen.add(key);last=size;
  let best:PreparedPhoto|undefined;
  for(const quality of [.8,.75]){
   const blob=await encode(size.width,size.height,quality);
   if(!blob||blob.type!=='image/webp')throw new Error('Urządzenie nie obsługuje kompresji WebP.');
   if(blob.size>0&&blob.size<=maxPhotoBytes){const candidate={blob,...size,quality};if(!best)best=candidate;if(blob.size<=targetBytes)return candidate;}
  }
  if(best)return best; // Preserve quality/resolution rather than shrink solely to reach 100 KB.
 }
 for(const quality of [.7,.65]){
  const blob=await encode(last.width,last.height,quality);
  if(!blob||blob.type!=='image/webp')throw new Error('Urządzenie nie obsługuje kompresji WebP.');
  if(blob.size>0&&blob.size<=maxPhotoBytes)return {blob,...last,quality};
 }
 throw new Error('Nie udało się zmieścić zdjęcia w 150 KB bez nadmiernego pogorszenia jakości. Wybierz inne zdjęcie.');
}
export async function preparePhoto(file:File):Promise<PreparedPhoto>{
 if(!file.size||file.size>20*1024*1024)throw new Error('Wybierz obraz o rozmiarze od 1 bajta do 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),size=rasterSize(bytes);
 const mime=bytes[0]===255?'image/jpeg':bytes[0]===137?'image/png':'image/webp';
 if(!size||(file.type&&file.type!==mime))throw new Error('Wybierz prawidłowy JPEG, PNG lub WebP.');
 const valid=(w:number,h:number)=>w>0&&h>0&&Math.max(w,h)<=8192&&w*h<=32_000_000;
 if(!valid(size.width,size.height))throw new Error('Obraz wejściowy przekracza 8192 px lub 32 megapiksele.');
 const url=URL.createObjectURL(new Blob([bytes],{type:mime})),image=new Image(),canvas=document.createElement('canvas');
 try {
  image.src=url;await image.decode();
  if(!valid(image.naturalWidth,image.naturalHeight))throw new Error('Nieprawidłowe wymiary obrazu.');
  const context=canvas.getContext('2d');if(!context)throw new Error('Nie można przygotować zdjęcia.');
  const result=await encodePhoto(image.naturalWidth,image.naturalHeight,async(w,h,q)=>{
   canvas.width=w;canvas.height=h;context.drawImage(image,0,0,w,h);
   return new Promise(resolve=>canvas.toBlob(resolve,'image/webp',q));
  });
  const encoded=new Uint8Array(await result.blob.arrayBuffer()),decoded=rasterSize(encoded);
  if(String.fromCharCode(...encoded.subarray(0,4))!=='RIFF'||String.fromCharCode(...encoded.subarray(8,12))!=='WEBP'||!decoded||decoded.width!==result.width||decoded.height!==result.height)throw new Error('Nie udało się potwierdzić formatu WebP.');
  return result;
 } finally {URL.revokeObjectURL(url);image.src='';canvas.width=0;canvas.height=0;}
}
