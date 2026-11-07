// The model and runtime are copied to our own origin at build time. No photo leaves the device.
type Mask={getAsUint8Array:()=>Uint8Array;close:()=>void};
type SegmentResult={categoryMask?:Mask;close?:()=>void};
type Segmenter={segment:(image:HTMLCanvasElement)=>SegmentResult;close:()=>void};
type VisionModule={
 FilesetResolver:{forVisionTasks:(url:string)=>Promise<unknown>};
 ImageSegmenter:{createFromOptions:(fileset:unknown,options:unknown)=>Promise<Segmenter>};
};
const ROOT='/mediapipe/vision/';
let modulePromise:Promise<VisionModule>|null=null;
async function visionModule():Promise<VisionModule>{
 if(!modulePromise){
  const path=ROOT+'tasks-vision.mjs';
  modulePromise=import(/* @vite-ignore */ path).then(m=>m as VisionModule).catch(error=>{modulePromise=null;throw error;});
 }
 return modulePromise;
}
export async function removePortraitBackground(image:HTMLCanvasElement):Promise<HTMLCanvasElement>{
 const {FilesetResolver,ImageSegmenter}=await visionModule();
 const fileset=await FilesetResolver.forVisionTasks(ROOT);
 const segmenter=await ImageSegmenter.createFromOptions(fileset,{
  baseOptions:{modelAssetPath:ROOT+'selfie_segmenter.tflite',delegate:'CPU'},
  runningMode:'IMAGE',
  outputCategoryMask:true,
  outputConfidenceMasks:false
 });
 try{
  const result=segmenter.segment(image);
  const mask=result.categoryMask;
  if(!mask)throw Error('Nie udało się wyznaczyć sylwetki.');
  const pixels=mask.getAsUint8Array();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Brak obsługi przetwarzania zdjęć.');
  ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(pixels.length!==canvas.width*canvas.height)throw Error('Nieprawidłowy rozmiar maski sylwetki.');
  // Selfie segmenter category labels: 0=background, 1=person.
  // Validate foreground coverage before allowing the result to reach Storage.
  let foreground=0;
  for(let i=0;i<pixels.length;i++){
   const person=pixels[i]===1;
   if(person)foreground++;
   data.data[i*4+3]=person?255:0;
  }
  const coverage=foreground/pixels.length;
  if(coverage<0.03||coverage>0.97)throw Error('Model nie wyodrębnił prawidłowo sylwetki. Zmień kadr lub wyłącz automatyczne usuwanie tła.');
  ctx.putImageData(data,0,0);
  result.close?.();
  return canvas;
 }finally{segmenter.close();}
}
