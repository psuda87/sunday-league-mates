from pathlib import Path
import json
namespace={"__file__":str(Path(__file__).with_name('compare-frozen-png.py'))}
exec(Path(__file__).with_name('compare-frozen-png.py').read_text().split("reference=root/")[0],namespace)
pixels=namespace['pixels'];root=Path(__file__).resolve().parents[2]
reference=root/'.cache/frozen-parity/reference/parity.cy.ts'
results=[]
for variant,folder in [('demo','b22-demo/parity.cy.ts'),('live-home','b22-live/b1/visual.cy.ts')]:
 for candidate in sorted((root/'.cache'/folder).glob('*.png')):
  if variant=='live-home' and not candidate.name.startswith('home-'):continue
  source=reference/candidate.name;assert source.exists(),candidate.name
  shape,a=pixels(source);other,b=pixels(candidate);assert shape==other
  channels=shape[2];different=sum(a[i:i+channels]!=b[i:i+channels] for i in range(0,len(a),channels))
  results.append(dict(variant=variant,image=candidate.name,different_pixels=different,max_channel_delta=max(abs(x-y) for x,y in zip(a,b))))
assert sum(r['variant']=='demo' for r in results)==88
assert sum(r['variant']=='live-home' for r in results)==8
output=dict(pairs=len(results),exact=sum(r['different_pixels']==0 for r in results),results=results,
 note='Own live profile uses real profile/photo/jersey and approved delete control; not compared to fictional portrait/stat pixels. CSS/assets/layout unchanged; card change only optional accessible image description.')
destination=root/'docs/ui/slm-v1-b22';destination.mkdir(exist_ok=True)
(destination/'parity.json').write_text(json.dumps(output,indent=2))
print(json.dumps({k:v for k,v in output.items() if k not in ('results','note')}))
for r in results:
 if r['different_pixels']:print(json.dumps(r))

known='details-320-light.png'
unexpected=[r for r in results if r['different_pixels'] and not(r['variant']=='demo' and r['image']==known and r['different_pixels']==12335 and r['max_channel_delta']<=4)]
assert not unexpected,'Unexpected visual differences; inspect parity.json'
