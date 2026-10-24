export const photoMaxBytes=2*1024*1024;
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
