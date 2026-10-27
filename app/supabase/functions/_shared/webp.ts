// Bounded, static WebP container validation. No trust in MIME or declared dimensions alone.
// Checks RIFF boundaries/padding, image chunks, keyframe headers and partition bounds.
export const webpMaxBytes=150000;
type Dimensions={width:number;height:number};
export function webpSize(b:Uint8Array):Dimensions|null {
 if(b.length<20||b.length>webpMaxBytes)return null;
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const tag=(n:number)=>String.fromCharCode(...b.subarray(n,n+4));
 const u24=(n:number)=>b[n]|b[n+1]<<8|b[n+2]<<16;
 if(tag(0)!=='RIFF'||tag(8)!=='WEBP'||v.getUint32(4,true)+8!==b.length)return null;
 let pos=12,image:Dimensions|null=null,extended:Dimensions|null=null,alpha=false,icc=false,flags=0;
 while(pos<b.length){
  if(pos+8>b.length)return null;
  const type=tag(pos),size=v.getUint32(pos+4,true),start=pos+8,end=start+size;
  if(size===0||end+(size&1)>b.length||(size&1&&b[end]!==0))return null;
  if(type==='VP8X'){
   if(pos!==12||size!==10||extended||b[start]&0xc3||b[start+1]||b[start+2]||b[start+3])return null;
   // No animation. Metadata chunks are unnecessary for browser-generated photos.
   if(b[start]&0x0e)return null;flags=b[start];
   extended={width:u24(start+4)+1,height:u24(start+7)+1};
  }else if(type==='ICCP'){
   if(!extended||image||alpha||icc||!(flags&32)||size<128||size>4096||v.getUint32(start,false)!==size||tag(start+36)!=='acsp')return null;icc=true;
  }else if(type==='ALPH'){
   if(!extended||image||alpha||b[start]&0xc0)return null;alpha=true;
  }else if(type==='VP8 '){
   if(image||size<11||b[start]&1||!(b[start]&0x10)||(b[start]>>1&7)>3||b[start+3]!==0x9d||b[start+4]!==1||b[start+5]!==0x2a)return null;
   const partition=u24(start)>>5;
   if(partition<1||partition+10>=size)return null;
   image={width:v.getUint16(start+6,true)&0x3fff,height:v.getUint16(start+8,true)&0x3fff};
  }else if(type==='VP8L'){
   if(image||alpha||size<6||b[start]!==0x2f||b[start+4]>>5)return null;
   const bits=v.getUint32(start+1,true);image={width:(bits&0x3fff)+1,height:(bits>>>14&0x3fff)+1};
  }else return null;
  pos=end+(size&1);
 }
 if(!image||image.width<1||image.height<1||image.width>800||image.height>800)return null;
 if(!!(flags&32)!==icc||alpha&&!(flags&16))return null;
 if(extended&&(extended.width!==image.width||extended.height!==image.height))return null;
 return image;
}
