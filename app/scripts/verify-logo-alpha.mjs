import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export function decodePng(bytes) {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  const depth=bytes[24],color=bytes[25],channels=color===6?4:color===2?3:0;
  assert.equal(depth,8); assert(channels,'Only original RGB and RGBA PNGs supported');
  assert.equal(bytes[28],0,'Interlaced PNG not supported');
  const chunks=[];
  for(let pos=8;pos<bytes.length;){const n=bytes.readUInt32BE(pos);if(bytes.toString('ascii',pos+4,pos+8)==='IDAT')chunks.push(bytes.subarray(pos+8,pos+8+n));pos+=n+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert(filter<=4);
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[i]=(raw[y*(stride+1)+x+1]+predictor)&255;
    }
  }
  return {width,height,channels,pixels};
}
export function verifyLogoAlpha(bytes) {
  const png=decodePng(bytes);assert.equal(png.channels,4,'Logo requires genuine alpha');
  const counts={transparent:0,soft:0,opaque:0};
  for(let i=3;i<png.pixels.length;i+=4){const a=png.pixels[i];counts[a===0?'transparent':a===255?'opaque':'soft']++;}
  assert(counts.transparent>png.width*png.height*.05);assert(counts.soft>100);assert(counts.opaque>100);
  for(const [x,y] of [[0,0],[png.width-1,0],[0,png.height-1],[png.width-1,png.height-1]])assert.equal(png.pixels[(y*png.width+x)*4+3],0,'Exterior corner must be transparent');
  return {width:png.width,height:png.height,...counts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  for(const kind of ['header','primary']){
    const bytes=readFileSync(new URL(`../public/assets/branding/slm-logo-${kind}-transparent.png`,import.meta.url));
    console.log(kind,verifyLogoAlpha(bytes));
  }
}
