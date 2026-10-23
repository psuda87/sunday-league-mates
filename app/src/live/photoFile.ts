import { jpegDimensions, photoMaxBytes } from '../../supabase/functions/_shared/profilePhoto';

export function rasterSize(bytes:Uint8Array):{width:number;height:number}|null {
  const jpeg=jpegDimensions(bytes);if(jpeg)return jpeg;
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.subarray(start,end));
  if(bytes.length<30||ascii(0,4)!=='RIFF'||ascii(8,12)!=='WEBP')return null;
  const tag=ascii(12,16);
  if(tag==='VP8X')return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(tag==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {width:(bytes[26]+(bytes[27]<<8))&16383,height:(bytes[28]+(bytes[29]<<8))&16383};
  if(tag==='VP8L'&&bytes[20]===47)return {width:1+((bytes[21]+(bytes[22]<<8))&16383),height:1+((bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10))};
  return null;
}
export async function prepareProfilePhoto(file:File):Promise<string> {
  if(file.size>photoMaxBytes)throw new Error('Wybierz zdjęcie do 2 MiB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const size=rasterSize(bytes);
  if(!size)throw new Error('Obsługiwane są zdjęcia JPEG, PNG i WebP. Zapisz zdjęcie HEIC jako JPEG.');
  if(size.width<1||size.height<1||Math.max(size.width,size.height)>4096)throw new Error('Maksymalny rozmiar zdjęcia to 4096 × 4096 pikseli.');
  const objectUrl=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=objectUrl;await image.decode();
    const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Nie udało się przygotować podglądu zdjęcia.');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.88);
    if(data.length>2800000)throw new Error('Zmniejsz zdjęcie i spróbuj ponownie.');
    return data;
  }catch(error){throw new Error(error instanceof Error&&error.message.startsWith('Zmniejsz')?error.message:'Nie można odczytać zdjęcia. Wybierz inny plik JPEG, PNG lub WebP.');}
  finally{URL.revokeObjectURL(objectUrl);}
}
