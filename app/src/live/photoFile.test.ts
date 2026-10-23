import { rasterSize } from './photoFile';
import { jpegDimensions } from '../../supabase/functions/_shared/profilePhoto';

test('odrzuca SVG/HEIC i uszkodzone dane zamiast ufać deklarowanemu MIME',()=>{
  expect(rasterSize(new TextEncoder().encode('<svg/>'))).toBeNull();
  expect(rasterSize(new TextEncoder().encode('ftypheic'))).toBeNull();
  expect(jpegDimensions(new Uint8Array([255,216,0,0,255,217]))).toBeNull();
});
test('odczytuje wymiary PNG bez dekodowania potencjalnie olbrzymiego obrazu',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);
  const view=new DataView(bytes.buffer);view.setUint32(16,999999);view.setUint32(20,100);
  expect(rasterSize(bytes)).toEqual({width:999999,height:100});
});
