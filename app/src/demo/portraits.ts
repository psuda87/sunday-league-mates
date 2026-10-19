export interface DemoPortrait {src:string;column?:0|1;row?:0|1}
export const demoPortraits:DemoPortrait[]=[0,1,2,3].map(i=>({src:'/assets/demo/fictional-portraits.webp',column:(i%2) as 0|1,row:Math.floor(i/2) as 0|1}));
export function validDemoPortrait(p:DemoPortrait) {
 if(typeof p?.src!=='string')return false;
 return demoPortraits.some(v=>v.src===p.src&&v.column===p.column&&v.row===p.row)||
  (p.column===undefined&&p.row===undefined&&p.src.length<=2800000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.src));
}
export async function readDemoPortrait(file:File):Promise<DemoPortrait> {
 if(file.size>2*1024*1024||!file.size)throw Error('Wybierz obraz o rozmiarze od 1 bajta do 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime||(file.type&&file.type!==mime))throw Error('Wybierz prawidłowy PNG, JPEG lub WebP. SVG i inne formaty nie są obsługiwane.');
 const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Nie udało się odczytać zdjęcia.'));reader.readAsDataURL(new Blob([bytes],{type:mime}));});
 await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth>4096||image.naturalHeight>4096?reject(Error('Maksymalny rozmiar obrazu to 4096 × 4096 px.')):resolve();image.onerror=()=>reject(Error('Nie udało się otworzyć obrazu.'));image.src=src;});
 return {src};
}
