describe('B2.2 client codec only — no Auth/Storage/upload',()=>{
 it('encodes real browser pixels as bounded WebP without changing aspect ratio',()=>{
  cy.visit('/cypress/fixtures/photo-preparation.html');
  cy.window().should('have.property','preparePhotoTest');
  cy.window().then(async win=>{
   const canvas=win.document.createElement('canvas');canvas.width=1600;canvas.height=1200;
   const context=canvas.getContext('2d')!,pixels=context.createImageData(1600,1200);
   let seed=17;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}context.putImageData(pixels,0,0);
   const original=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!),'image/png'));
   const prepare=(win as unknown as {preparePhotoTest:(file:File)=>Promise<{blob:Blob;width:number;height:number;quality:number}>}).preparePhotoTest;
   const result=await prepare(new win.File([original],'fictional-noise.png',{type:'image/png'}));
   expect(result.blob.type).eq('image/webp');expect(result.blob.size).at.most(150_000);expect(result.width).at.most(800);expect(result.height).at.most(800);expect(result.width/result.height).closeTo(4/3,.005);
   const bitmap=await win.createImageBitmap(result.blob);expect(bitmap.width).eq(result.width);expect(bitmap.height).eq(result.height);bitmap.close();
  });
 });
});
