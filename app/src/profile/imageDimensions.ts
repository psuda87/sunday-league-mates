// Reused from the previous local photo integration; no network or storage.
export function jpegDimensions(bytes:Uint8Array):{width:number;height:number}|null {
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return null;
  let offset=2;
  while(offset+4<bytes.length) {
    if(bytes[offset++]!==255)return null;
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===218||marker===217)return null;
    if(marker===1||(marker>=208&&marker<=215))continue;
    const length=bytes[offset]*256+bytes[offset+1];
    if(length<2||offset+length>bytes.length)return null;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if(length<8)return null;
      const height=bytes[offset+3]*256+bytes[offset+4],width=bytes[offset+5]*256+bytes[offset+6];
      return width>0&&height>0?{width,height}:null;
    }
    offset+=length;
  }
  return null;
}

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
