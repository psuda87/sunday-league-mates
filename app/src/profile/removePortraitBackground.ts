// The model and runtime are copied to our own origin at build time. No photo leaves the device.
type Mask={getAsFloat32Array:()=>Float32Array;close:()=>void};
type SegmentResult={confidenceMasks?:Mask[];close?:()=>void};
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
  outputCategoryMask:false,
  outputConfidenceMasks:true
 });
 try{
  const result=segmenter.segment(image);
  const masks=result.confidenceMasks;
  if(!masks||masks.length<2)throw Error('Model nie zwrócił maski sylwetki.');
  // Confidence mask index 1 corresponds to the person class.
  const pixels=masks[1].getAsFloat32Array();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Brak obsługi przetwarzania zdjęć.');
  ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(pixels.length!==canvas.width*canvas.height)throw Error('Nieprawidłowy rozmiar maski sylwetki.');
  let foreground=0;
  for(let i=0;i<pixels.length;i++){
   const confidence=pixels[i];
   if(!Number.isFinite(confidence))throw Error('Nieprawidłowa maska sylwetki.');
   const alpha=Math.round(Math.max(0,Math.min(1,(confidence-0.15)/0.7))*255);
   if(alpha>128)foreground++;
   data.data[i*4+3]=Math.round(data.data[i*4+3]*alpha/255);
  }
  const coverage=foreground/pixels.length;
  if(coverage<0.03||coverage>0.97)throw Error('Model nie wyodrębnił prawidłowo sylwetki. Zmień kadr lub wyłącz automatyczne usuwanie tła.');
  ctx.putImageData(data,0,0);
  result.close?.();
  return canvas;
 }finally{segmenter.close();}
}
