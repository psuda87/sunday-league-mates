from pathlib import Path
import json
# Reuse exact stdlib pixel decoder; no image modifications.
namespace={"__file__":str(Path(__file__).with_name('compare-frozen-png.py'))}
exec(Path(__file__).with_name('compare-frozen-png.py').read_text().split("reference=root/")[0],namespace)
pixels=namespace['pixels'];root=Path(__file__).resolve().parents[2]
reference=root/'.cache/frozen-parity/reference/parity.cy.ts'
results=[]
for variant,folder in [('demo','b1-demo/parity.cy.ts'),('live','b1-live/visual.cy.ts')]:
 for candidate in sorted((root/'.cache/frozen-parity'/folder).glob('*.png')):
  if variant=='live' and candidate.name.startswith('login-'):continue # Approved semantic differences; reviewed separately.
  source=reference/candidate.name
  assert source.exists(),candidate.name
  shape,a=pixels(source);other,b=pixels(candidate);assert shape==other
  channels=shape[2];different=sum(a[i:i+channels]!=b[i:i+channels] for i in range(0,len(a),channels))
  maximum=max(abs(x-y) for x,y in zip(a,b))
  results.append(dict(variant=variant,image=candidate.name,different_pixels=different,max_channel_delta=maximum,width=shape[0],height=shape[1]))
assert len([r for r in results if r['variant']=='demo'])==88
assert len([r for r in results if r['variant']=='live'])==16
output=dict(pairs=len(results),exact=sum(r['different_pixels']==0 for r in results),results=results)
destination=root/'docs/ui/slm-v1-b1';destination.mkdir(exist_ok=True)
(destination/'parity.json').write_text(json.dumps(output,indent=2))
print(json.dumps({k:v for k,v in output.items() if k!='results'}))
for r in results:
 if r['different_pixels']:print(json.dumps(r))
