import { expect,it,vi } from 'vitest';
import { encodePhoto,fitPhoto,maxPhotoBytes,parseJerseyNumber,preparePhoto } from './preparePhoto';
const blob=(bytes:number,type='image/webp')=>new Blob([new Uint8Array(bytes)],{type});
it('accepts 0–99 including duplicates, rejects decimals and out-of-range input',()=>{
 for(const value of ['0','1','99',' 27 ','00'])expect(parseJerseyNumber(value)).toBe(Number(value));
 expect(parseJerseyNumber('27')).toBe(parseJerseyNumber('27'));
 for(const value of ['','100','-1','1.5','1e1','x'])expect(()=>parseJerseyNumber(value)).toThrow();
});
it('fits without upscaling and preserves landscape/portrait proportions',()=>{
 expect(fitPhoto(4000,3000)).toEqual({width:800,height:600});expect(fitPhoto(3000,4000)).toEqual({width:600,height:800});expect(fitPhoto(80,40)).toEqual({width:80,height:40});
});
it('uses WebP 80% and does not pad small images to 40 KB',async()=>{
 const encode=vi.fn(async()=>blob(2048));const result=await encodePhoto(4000,3000,encode);
 expect(encode).toHaveBeenCalledWith(800,600,.8);expect(result.blob.size).toBe(2048);
});
it('tries quality then resolution and enforces the hard byte limit',async()=>{
 const encode=vi.fn(async(w:number,_h:number,q:number)=>blob(w===640&&q===.75?90*1024:200*1024));
 const result=await encodePhoto(4000,3000,encode);expect(result.width).toBe(640);expect(result.height).toBe(480);expect(result.quality).toBe(.75);expect(result.blob.size).toBeLessThanOrEqual(maxPhotoBytes);
});
it('keeps 800px/80% when fitting in 150 KB instead of degrading just to hit 100 KB',async()=>{
 const result=await encodePhoto(800,800,async()=>blob(130*1024));expect(result.width).toBe(800);expect(result.quality).toBe(.8);
});
it('rejects unsupported encoders, failures and images that cannot fit safely',async()=>{
 await expect(encodePhoto(800,800,async()=>blob(10,'image/png'))).rejects.toThrow('WebP');
 await expect(encodePhoto(800,800,async()=>null)).rejects.toThrow();
 await expect(encodePhoto(800,800,async()=>blob(maxPhotoBytes+1))).rejects.toThrow('150 KB');
 await expect(preparePhoto(new File(['not-image'],'x.svg',{type:'image/svg+xml'}))).rejects.toThrow();
});
