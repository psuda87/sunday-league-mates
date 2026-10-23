"""Exact PNG pixel comparison with stdlib only; no screenshot alteration."""
from pathlib import Path
import json,struct,zlib
root=Path(__file__).resolve().parents[2]
def pixels(path):
 data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';offset=8;compressed=b''
 while offset<len(data):
  size=struct.unpack('>I',data[offset:offset+4])[0];kind=data[offset+4:offset+8];chunk=data[offset+8:offset+8+size];offset+=size+12
  if kind==b'IHDR':width,height,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',chunk)
  if kind==b'IDAT':compressed+=chunk
 assert depth==8 and color in (2,6) and interlace==0
 channels=3 if color==2 else 4;stride=width*channels;raw=zlib.decompress(compressed);result=bytearray();previous=bytearray(stride);offset=0
 for _ in range(height):
  mode=raw[offset];offset+=1;row=bytearray(raw[offset:offset+stride]);offset+=stride
  for i in range(stride):
   a=row[i-channels] if i>=channels else 0;b=previous[i];c=previous[i-channels] if i>=channels else 0
   if mode==1:row[i]=(row[i]+a)&255
   elif mode==2:row[i]=(row[i]+b)&255
   elif mode==3:row[i]=(row[i]+(a+b)//2)&255
   elif mode==4:
    p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c);row[i]=(row[i]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
   else:assert mode==0
  result.extend(row);previous=row
 return (width,height,channels),result
reference=root/'.cache/frozen-parity/reference/parity.cy.ts';candidate=root/'.cache/frozen-parity/candidate/parity.cy.ts'
results=[]
for source in sorted(reference.glob('*.png')):
 target=candidate/source.name
 if not target.exists():results.append({'image':source.name,'missing':True});continue
 shape,a=pixels(source);other,b=pixels(target);assert shape==other,source.name
 channels=shape[2];different=sum(a[i:i+channels]!=b[i:i+channels] for i in range(0,len(a),channels))
 results.append({'image':source.name,'width':shape[0],'height':shape[1],'different_pixels':different,'fraction':different/(shape[0]*shape[1])})
assert len(results)>=88,'Expected 11 screens x 4 widths x 2 themes'
output={'pairs':len(results),'exact':sum(r.get('different_pixels')==0 for r in results),'results':results}
(root/'.cache/frozen-parity/result.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in output.items() if k!='results'}))
for item in results:
 if item.get('different_pixels')!=0:print(json.dumps(item))
if output['exact']!=output['pairs']:raise SystemExit(1)
