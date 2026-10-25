"""Verify a local-only debug artifact; never prints credentials or user data."""
from pathlib import Path
import hashlib,json,sys,zipfile
variant=sys.argv[1];assert variant in ('live','premium')
app=Path(__file__).resolve().parents[1]
directory='dist-b1' if variant=='premium' else 'dist-live-local'
apk=app/'android/app/build/outputs/apk/debug/app-debug.apk'
with zipfile.ZipFile(apk) as z:
    config=json.loads(z.read('assets/capacitor.config.json'))
    assert config['appId']=='pl.psuda87.slm' and config['appName']=='Sunday League Mates'
    assert config['webDir']==directory and config['loggingBehavior']=='none'
    assert config['android']['webContentsDebuggingEnabled'] is False
    for path in (app/directory).rglob('*'):
        if path.is_file():assert z.read('assets/public/'+path.relative_to(app/directory).as_posix())==path.read_bytes(),path.name
    js=b''.join(z.read(n) for n in z.namelist() if n.startswith('assets/public/') and n.endswith('.js'))
    assert b'http://127.0.0.1:54321/functions/v1/accounts' in js
    assert b'https://hjtcyybkxebvdropchac.supabase.co/functions' not in js
    assert b'service_role' not in js and b'SUPABASE_ACCESS_TOKEN' not in js
print('PASS '+variant+' debug APK: identity, fresh exact assets, localhost API, no service key markers.')
print('SHA256 '+hashlib.sha256(apk.read_bytes()).hexdigest())
