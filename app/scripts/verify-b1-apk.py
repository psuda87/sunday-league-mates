"""B1 local Auth artifact checks; no credentials or token values are printed."""
from pathlib import Path
import zipfile,json,hashlib,subprocess
app=Path(__file__).resolve().parents[1]
apk=app/'android/app/build/outputs/apk/debug/app-debug.apk'
with zipfile.ZipFile(apk) as z:
 config=json.loads(z.read('assets/capacitor.config.json'))
 assert config['appId']=='pl.psuda87.slm'
 assert config['webDir']=='dist-b1' and config['loggingBehavior']=='none'
 assert config['android']['webContentsDebuggingEnabled'] is False
 files=list((app/'dist-b1').rglob('*'))
 for p in files:
  if p.is_file():assert z.read('assets/public/'+p.relative_to(app/'dist-b1').as_posix())==p.read_bytes(),p.name
 js=b''.join(z.read(n) for n in z.namelist() if n.startswith('assets/public/') and n.endswith('.js'))
 assert b'http://127.0.0.1:54321/functions/v1/accounts' in js
 assert b'https://hjtcyybkxebvdropchac.supabase.co/functions' not in js
 assert b'service_role' not in js and b'SUPABASE_ACCESS_TOKEN' not in js
print('PASS B1 APK: package/config/local endpoint/exact fresh assets/no service key markers')
print('APK SHA256 '+hashlib.sha256(apk.read_bytes()).hexdigest())
print('Source HEAD '+subprocess.check_output(['git','rev-parse','HEAD'],cwd=app,text=True).strip()+' (include git status for uncommitted build changes)')
