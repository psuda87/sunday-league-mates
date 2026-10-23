"""Harden only local Auth; retain original stopped container, never touch database."""
import json,subprocess,tempfile,os
from pathlib import Path
def docker(args):
 r=subprocess.run(["docker",*args],capture_output=True,text=True)
 if r.returncode: raise RuntimeError("Local Docker operation failed: "+args[0])
 return r.stdout
repo=Path(__file__).resolve().parents[2]
assert subprocess.check_output(["git","branch","--show-current"],cwd=repo,text=True).strip() in ("feat/integration", "feat/premium318-live")
host=docker(["context","inspect","--format","{{.Endpoints.docker.Host}}"]).strip()
assert (os.environ.get("DOCKER_HOST") or host).startswith(("npipe://","unix://"))
name="supabase_auth_sunday-league-mates"
c=json.loads(docker(["inspect",name]))[0]
assert not c["Mounts"]
env=dict(x.split("=",1) for x in c["Config"]["Env"])
desired=dict(GOTRUE_DISABLE_SIGNUP="true",GOTRUE_EXTERNAL_PHONE_ENABLED="false",GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION="false",GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD="true",GOTRUE_PASSWORD_MIN_LENGTH="8",GOTRUE_MAILER_AUTOCONFIRM="false",GOTRUE_HOOK_SEND_EMAIL_ENABLED="true",GOTRUE_HOOK_SEND_EMAIL_URI="pg-functions://postgres/public/slm_account_block_email",GOTRUE_HOOK_SEND_SMS_ENABLED="true",GOTRUE_HOOK_SEND_SMS_URI="pg-functions://postgres/public/slm_account_block_sms")
if all(env.get(k)==v for k,v in desired.items()):
 print("Local Auth already hardened; no container recreated")
 raise SystemExit(0)
env.update(desired)
backup=name+"_before_http_tests"
while subprocess.run(["docker","inspect",backup],capture_output=True).returncode==0:
 backup += "_previous"

folder=Path(__file__).resolve().parents[2]/".cache"; folder.mkdir(exist_ok=True)
fd,path=tempfile.mkstemp(dir=folder,suffix=".env")
try:
 with os.fdopen(fd,"w",encoding="utf-8") as f:
  for k,v in env.items():
   assert "\n" not in v
   f.write(k+"="+v+"\n")
 docker(["stop",name]); docker(["rename",name,backup])
 args=["create","--name",name,"--network",c["HostConfig"]["NetworkMode"],"--env-file",path,"--restart","unless-stopped"]
 for k,v in (c["Config"].get("Labels") or {}).items(): args += ["--label",k+"="+v]
 hc=c["Config"].get("Healthcheck")
 if hc and hc["Test"][0]=="CMD-SHELL": args += ["--health-cmd",hc["Test"][1],"--health-interval","5s","--health-retries","5"]
 entry=c["Config"].get("Entrypoint") or []
 assert len(entry)<=1
 if entry: args += ["--entrypoint",entry[0]]
 args += [c["Config"]["Image"],*(c["Config"].get("Cmd") or [])]
 docker(args); docker(["start",name]); print("Local Auth hardened; original stopped backup retained; DB unchanged")
finally: os.unlink(path)
