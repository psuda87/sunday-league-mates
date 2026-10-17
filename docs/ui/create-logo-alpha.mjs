// Offline asset preparation only. Requires ImageMagick 7; never imported by app/demo.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../app/public/assets/branding/',import.meta.url));
const jobs=[
 {name:'header',w:290,h:280,core:[[25,105],[54,92],[100,89],[151,94],[194,109],[194,230],[174,252],[142,278],[111,297],[77,278],[46,250],[26,227]]},
 {name:'primary',w:450,h:505,core:[[250,9],[284,40],[334,64],[398,91],[400,160],[449,185],[449,367],[407,382],[379,420],[332,455],[246,496],[167,459],[121,424],[84,381],[45,359],[44,186],[95,162],[96,94],[165,66],[213,38]]}
];
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c;}
const clamp=x=>Math.max(0,Math.min(1,x));
const audit=[];
for(const job of jobs){
 const file=root+'slm-logo-'+job.name+'.png';
 const raw=execFileSync('magick',[file,'-depth','8','rgba:-'],{maxBuffer:10_000_000});
 assert.equal(raw.length,job.w*job.h*4,'Original dimensions changed; review mask before regenerating');
 const out=Buffer.from(raw);
 let transparent=0,soft=0,protectedCount=0;
 for(let y=0;y<job.h;y++)for(let x=0;x<job.w;x++){
  const i=(y*job.w+x)*4;
  const protectedPixel=inside(x+.5,y+.5,job.core);
  if(protectedPixel){out[i+3]=255;protectedCount++;continue;}
  const rgb=[raw[i],raw[i+1],raw[i+2]], high=Math.max(...rgb),low=Math.min(...rgb);
  // Exterior matte is near-black/neutral. Keep colored crown/streaks; never key inside the shield.
  const saturation=high? (high-low)/high:0;
  const chroma=clamp((saturation-.28)/.25);
  const signal=clamp((high-28)/58);
  let alpha=chroma*signal;
  // Remove unrelated source caption and neutral studio background in the primary's upper-left.
  if(job.name==='primary') {
    const strokes=inside(x+.5,y+.5,[[0,185],[449,80],[449,320],[0,463]]);
    alpha=strokes ? chroma*clamp((high-65)/70) : 0;
  }
  out[i+3]=Math.round(alpha*255);
  if(out[i+3]===0){transparent++;out[i]=out[i+1]=out[i+2]=0;}
  else if(out[i+3]<255){
   soft++;
   // Unmatte only translucent exterior pixels; retain original opaque RGB pixels.
   const a=out[i+3]/255;
   for(let k=0;k<3;k++)out[i+k]=Math.min(255,Math.round(Math.max(0,raw[i+k]-Math.min(18,low)*(1-a))/a));
  }
 }
 const output=root+'slm-logo-'+job.name+'-transparent.png';
 execFileSync('magick',['-size',`${job.w}x${job.h}`,'-depth','8','rgba:-','-define','png:color-type=6',output],{input:out});
 const actual=execFileSync('magick',[output,'-depth','8','rgba:-'],{maxBuffer:10_000_000});
 let preservedBlack=0;
 for(let y=0;y<job.h;y++)for(let x=0;x<job.w;x++)if(inside(x+.5,y+.5,job.core)){
  const i=(y*job.w+x)*4;
  assert.deepEqual(actual.subarray(i,i+3),raw.subarray(i,i+3),'Protected original RGB changed');
  assert.equal(actual[i+3],255,'Protected shield must be opaque');
  if(Math.max(raw[i],raw[i+1],raw[i+2])<40)preservedBlack++;
 }
 assert(transparent>job.w*job.h*.05 && soft>100 && preservedBlack>100);
 for(const i of [0,(job.w-1)*4,(job.h-1)*job.w*4,(job.w*job.h-1)*4])assert.equal(actual[i+3],0,'Corner matte remains');
 audit.push({preservedBlack,name:job.name,width:job.w,height:job.h,transparent,soft,protectedCount,corePolygon:job.core,sourceSHA256:createHash('sha256').update(readFileSync(file)).digest('hex'),transparentSHA256:createHash('sha256').update(readFileSync(output)).digest('hex')});
}
writeFileSync(new URL('./premium32-alpha-audit.json',import.meta.url),JSON.stringify(audit,null,2));
