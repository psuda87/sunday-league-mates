"""Verify the frozen demo is really embedded, without touching a device/backend."""
from pathlib import Path
import hashlib,json,os,subprocess,zipfile
app=Path(__file__).resolve().parents[1]
apk=app/'android/app/build/outputs/apk/debug/app-debug.apk'
sdk=Path(os.environ.get('ANDROID_HOME',str(Path(os.environ['LOCALAPPDATA'])/'Android/Sdk')))
build_tools=sorted((sdk/'build-tools').iterdir())[-1]
with zipfile.ZipFile(apk) as z:
 config=json.loads(z.read('assets/capacitor.config.json'))
 assert config['appId']=='pl.psuda87.slm' and config['webDir']=='dist-demo'
 assert config.get('loggingBehavior')=='none'
 count=0
 for path in (app/'dist-demo').rglob('*'):
  if not path.is_file():continue
  relative=path.relative_to(app/'dist-demo').as_posix()
  assert z.read('assets/public/'+relative)==path.read_bytes(),relative
  count+=1
 for name in z.namelist():
  if name.startswith('assets/public/') and name.endswith(('.js','.html')):
   source=z.read(name)
   assert not any(token in source for token in [b'/functions/v1/',b'SessionManager',b'VITE_SLM_FUNCTION_URL',b'supabase.co']),name
badging=subprocess.check_output([str(build_tools/'aapt.exe'),'dump','badging',str(apk)],text=True,encoding='utf-8')
assert "name='pl.psuda87.slm'" in badging and "application-label:'Sunday League Mates'" in badging
subprocess.run(['cmd','/c',str(build_tools/'apksigner.bat'),'verify',str(apk)],check=True,capture_output=True)
report={'application_id':'pl.psuda87.slm','base':'d0f9fa9f840d2bd7f4985d00c24ee9a703f6b3e4','apk':str(apk),'bytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'verified_web_files':count,'device_installed':False}
cache=app.parent/'.cache';cache.mkdir(exist_ok=True)
(cache/'frozen-apk.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
