import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {webpSize} from './webp';
const original=Uint8Array.from(atob(JSON.parse(readFileSync('supabase/functions/fixtures/webp.json','utf8')).base64),c=>c.charCodeAt(0));
it('keeps real browser-generated WebP dimensions and input bytes unchanged',()=>{const before=original.slice();expect(webpSize(original)).toMatchObject({width:expect.any(Number),height:expect.any(Number)});expect(original).toEqual(before);});
it('rejects an extended canvas inconsistent with the actual encoded picture',()=>{const b=original.slice();b[24]^=1;expect(webpSize(b)).toBeNull();});
it('rejects truncated and oversize WebP without unbounded parsing',()=>{expect(webpSize(original.subarray(0,20))).toBeNull();expect(webpSize(new Uint8Array(150001))).toBeNull();});
