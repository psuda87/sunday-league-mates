"""Connect an existing Android LIVE APK64321 to the one local backend55321. No APK install/launch."""
import argparse
from pathlib import Path
import os
import re
import subprocess
import urllib.request
import json
import zipfile
import time


def cmd(args, data=None):
    p=subprocess.run(args,input=data,capture_output=True,timeout=20)
    if p.returncode:
        raise RuntimeError('ADB operation failed; no driver/account settings changed')
    return p.stdout


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only',action='store_true',help='Do not create a missing reverse mapping')
    parser.add_argument('--serial',help='Explicit ADB device/emulator; required if multiple are connected')
    args=parser.parse_args()
    sdk=Path(os.environ.get('ANDROID_HOME') or Path(os.environ.get('LOCALAPPDATA',Path.home()/'AppData/Local'))/'Android/Sdk')
    adb=sdk/'platform-tools/adb.exe'
    assert adb.exists(),'Existing Android SDK/ADB not found'
    rows=[s.split() for s in cmd([str(adb),'devices']).decode().splitlines()[1:] if s.strip()]
    ready=[row[0] for row in rows if len(row)>1 and row[1]=='device' and (not args.serial or row[0]==args.serial)]
    if len(ready)!=1:
        print('Exactly one authorized Android target required; use --serial when several are available. No changes made.')
        raise SystemExit(2)
    kong=json.loads(cmd(['docker','inspect','supabase_kong_slm-main-stabilization']))[0]
    assert kong['Config']['Labels']['com.supabase.cli.project']=='slm-main-stabilization' and kong['State']['Running']
    with urllib.request.urlopen('http://127.0.0.1:55321/auth/v1/health',timeout=5) as response:
        assert response.status==200,'Start the existing local backend first'
    base=[str(adb),'-s',ready[0]]
    # Read the installed APK, not its versionName (all historical builds use1.0).
    package=cmd(base+['shell','pm','path','pl.psuda87.slm']).decode().splitlines()
    remote=next((s[len('package:'):] for s in package if s.startswith('package:') and s.endswith('/base.apk')),None)
    assert remote,'SLM package not found; installation requires owner action'
    artifact=Path(__file__).resolve().parents[2]/'.cache/live-backend/installed-apk-check.apk'
    artifact.parent.mkdir(parents=True,exist_ok=True)
    cmd(base+['pull',remote,str(artifact)])
    with zipfile.ZipFile(artifact) as apk:
        config=json.loads(apk.read('assets/capacitor.config.json'))
        assert config.get('appId')=='pl.psuda87.slm' and config.get('webDir')=='dist-android-stage3','Installed APK is not local LIVE; prepare LIVE and let owner install it'
        scripts=[apk.read(n).decode(errors='replace') for n in apk.namelist() if n.startswith('assets/public/assets/') and n.endswith('.js')]
        assert any('http://127.0.0.1:64321/functions/v1/accounts' in s for s in scripts),'Unexpected installed backend endpoint'
        assert not any('https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts' in s for s in scripts),'Cloud APK refused'
        assert config.get('loggingBehavior')=='none' and not config.get('android',{}).get('webContentsDebuggingEnabled')
    rows=[s.split()[-2:] for s in cmd(base+['reverse','--list']).decode().splitlines() if s.strip()]
    existing=[r for r in rows if r[0]=='tcp:64321']
    if existing:
        assert existing==[['tcp:64321','tcp:55321']],'Conflicting mapping retained; owner decision required'
    elif args.check_only:
        raise SystemExit('Mapping absent; check-only leaves device unchanged')
    else:
        cmd(base+['reverse','--no-rebind','tcp:64321','tcp:55321'])
    for path in ['/auth/v1/health','/functions/v1/accounts']:
        body=b'{"action":"status"}' if path.endswith('/accounts') else b''
        method='POST' if body else 'GET'
        wire=(method+' '+path+' HTTP/1.1\r\nHost: localhost\r\nOrigin: https://localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: '+str(len(body))+'\r\n\r\n').encode()+body
        # ADB shell can close the remote socket on immediate stdin EOF. Keep
        # input open briefly so nc receives the HTTP response before shutdown.
        process=subprocess.Popen(base+['shell','-T','toybox','nc','-w','3','127.0.0.1','64321'],
                                 stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        process.stdin.write(wire);process.stdin.flush();time.sleep(1)
        process.stdin.close();process.stdin=None
        try:
            result,_=process.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill();process.communicate()
            raise RuntimeError('Android forwarded HTTP check timed out')
        assert process.returncode==0,'Android network probe failed'
        codes=re.findall(rb'HTTP/1.[01] (\d+)',result)
        assert codes and int(codes[0])==(401 if body else 200),'Android forwarded HTTP verification failed'
        print('PASS Android HTTP '+path+' '+codes[0].decode())
    print('Android64321 -> ADB -> host55321. No APK installation, launch or token-store changes.')
