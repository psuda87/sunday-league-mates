"""Retire proven historical SLM test services. Never delete databases, volumes, host data, images or networks."""
import argparse
import csv
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
PRIMARY = 'slm-main-stabilization'
OUT = ROOT / '.cache/live-backend'
RETIRED_PROJECTS = {'slm-premium-behavior-review','slm-premium-real-finance','slm-premium-real-events',
                    'slm-online-readiness','slm-account-mail','slm-email-regression','slm-account-final',
                    'slm-account-candidate','slm-account-foundation','slm-pr16-review','sunday-league-mates'}


def run(args, timeout=180):
    p = subprocess.run(args, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('Local operation failed: ' + args[0] + ' ' + args[1])
    return p.stdout


def inspect_all():
    ids = run(['docker','ps','-aq']).decode().split()
    result = []
    for i in range(0, len(ids), 40):
        result += json.loads(run(['docker','inspect',*ids[i:i+40]]))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    host = os.environ.get('DOCKER_HOST') or run(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}']).decode().strip()
    assert host.startswith(('npipe://','unix://')), 'Local Docker socket required'
    common = Path(run(['git','rev-parse','--path-format=absolute','--git-common-dir']).decode().strip()).resolve()
    worktrees = [Path(s[9:]).resolve() for s in run(['git','worktree','list','--porcelain']).decode().splitlines() if s.startswith('worktree ')]
    cs = inspect_all()
    primary = [c for c in cs if (c['Config'].get('Labels') or {}).get('com.supabase.cli.project') == PRIMARY]
    assert len(primary) == 6 and all(c['State']['Running'] for c in primary), 'Keep the working primary intact'
    candidates, unknown = {}, []
    for c in cs:
        name = c['Name'].lstrip('/'); labels = c['Config'].get('Labels') or {}
        project = labels.get('com.supabase.cli.project')
        if project == PRIMARY:
            continue
        fixture = labels.get('slm.fixture') in ('lineups-stage2a','lineups-edge-stage2a','premium-finance-stage2')
        fixture = fixture and bool(re.fullmatch(r'slm-(?:lineups-(?:edge|stage2a)|finance-sql)-[0-9a-f]{12}(?:-(?:rest|auth|edge))?',name))
        if not fixture and re.fullmatch(r'slm-lineups-stage2a-[0-9a-f]{12}-rest',name):
            parent = next((x for x in cs if x['Name'].lstrip('/') == name[:-5]),None)
            fixture = bool(parent and (parent['Config'].get('Labels') or {}).get('slm.fixture') == 'lineups-stage2a' and c['HostConfig']['NetworkMode'] == 'container:'+parent['Id'])
        owned = False
        if project in RETIRED_PROJECTS and labels.get('com.supabase.cli.workdir'):
            directory = Path(labels['com.supabase.cli.workdir']).resolve()
            config = directory / 'supabase/config.toml'
            owned = any(directory.is_relative_to(w) for w in worktrees) and config.exists()
            if owned:
                owned = Path(run(['git','-C',str(directory),'rev-parse','--path-format=absolute','--git-common-dir']).decode().strip()).resolve() == common
            if owned:
                owned = bool(re.search(r'^project_id\s*=\s*"'+re.escape(project)+'"',config.read_text(),re.M))
        if not (fixture or owned):
            unknown.append({'id':c['Id'],'name':name,'reason':'ownership/function not conclusively established'})
            continue
        # Persistent resources remain as containers as well as volumes.
        database = name.startswith('supabase_db_') or c['Config']['Image'].startswith(('postgres:','postgres@','public.ecr.aws/supabase/postgres:'))
        stateless_role = fixture and not database or name.startswith(tuple('supabase_'+s+'_' for s in ('auth','rest','kong','studio','pg_meta','realtime')))
        removable = bool(stateless_role and not c['Mounts'] and not database)
        # Mounted data need not be deleted with a reproducible API container.
        # Strictly recognise the reviewed code/cache/bucket layout; NEVER use -v.
        edge = c['Image']=='sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8'
        edge_mounts = all((m['Type']=='volume' and m['Destination']=='/root/.cache/deno') or
                          (m['Type']=='bind' and not m['RW'] and (m['Destination']=='/fixture' or m['Destination'].endswith('/supabase/functions')))
                          for m in c['Mounts'])
        studio = owned and c['Config']['Image']=='public.ecr.aws/supabase/studio:2026.10.12-sha-3699278'
        studio_mounts = all((m['Type']=='volume' and m['Destination']=='/root/.cache/deno') or
                            (m['Type']=='bind' and (m['Destination'].endswith('/supabase/snippets') or
                                                   not m['RW'] and m['Destination'].endswith('/supabase/functions')))
                            for m in c['Mounts'])
        env=dict(s.split('=',1) for s in c['Config']['Env'])
        storage = owned and c['Config']['Image']=='public.ecr.aws/supabase/storage-api:v1.82.1' and env.get('STORAGE_BACKEND')=='file' and env.get('FILE_STORAGE_BACKEND_PATH')=='/mnt'
        storage_mounts = len(c['Mounts'])==1 and c['Mounts'][0]['Type']=='volume' and c['Mounts'][0]['Destination']=='/mnt'
        if (edge and edge_mounts or studio and studio_mounts or storage and storage_mounts) and not database:
            # A dirty Storage root could hold unexpected files outside /mnt.
            if not storage or not run(['docker','diff',c['Id']]).strip():
                removable=True
        candidates[c['Id']] = {'id':c['Id'],'name':name,'project':project or labels.get('slm.fixture') or 'lineups-stage2a',
                              'action':'remove-stateless' if removable else 'stop-preserve-container',
                              'reason':'reproducible SLM API/UI/code service; no persistent data in container; external code/cache/bucket/snippet mounts retained' if removable else 'preserve database or unclassified service state',
                              'mounts_preserved':[{k:m.get(k) for k in ('Type','Name','Destination','RW')} for m in c['Mounts']],
                              'was_running':c['State']['Running']}
    # Never stop a database/project with an active non-health SQL workload.
    busy = set()
    for c in cs:
        if c['Id'] not in candidates or not c['State']['Running']:
            continue
        name=c['Name'].lstrip('/')
        if not (name.startswith('supabase_db_') or c['Config']['Image'].startswith(('postgres:','postgres@'))):
            continue
        q="select count(*) from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' and state='active' and query not ilike '%select 1%'"
        p=subprocess.run(['docker','exec',c['Id'],'psql','-X','-qAt','-U','postgres','-c',q],capture_output=True,timeout=15)
        if p.returncode or p.stdout.strip()!=b'0':
            busy.add(candidates[c['Id']]['project'])
    for id in list(candidates):
        if candidates[id]['project'] in busy:
            unknown.append({**candidates.pop(id),'reason':'active SQL workload or unavailable activity check'})
    # A missing label is not evidence of isolation: an unclassified GoTrue can
    # still depend on a labelled database through a shared bridge/DB URI.
    unknown_networks=set()
    for c in cs:
        if c['State']['Running'] and c['Id'] not in candidates and c not in primary:
            unknown_networks.update(n for n in c['NetworkSettings']['Networks'] if n not in ('none','host','bridge'))
    for id in list(candidates):
        c=next(c for c in cs if c['Id']==id)
        if unknown_networks.intersection(c['NetworkSettings']['Networks']):
            unknown.append({**candidates.pop(id),'reason':'shared network has a running unclassified user; preserve entire project'})
    # Namespace/legacy-link users outside the retirement set block that resource.
    for id in list(candidates):
        name=candidates[id]['name']
        deps=[c for c in cs if c['Id'] not in candidates and
              (c['HostConfig']['NetworkMode']=='container:'+id or
               any(id in x or name in x for x in (c['HostConfig'].get('VolumesFrom') or [])+(c['HostConfig'].get('Links') or [])))]
        if deps:
            unknown.append({**candidates.pop(id),'reason':'external dependent container'})
    plan={'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'primary':PRIMARY,
          'before':len(cs),'actions':list(candidates.values()),'preserved_unknown':unknown}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'retirement-plan.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
    print(json.dumps({'before':len(cs),'remove':sum(x['action']=='remove-stateless' for x in candidates.values()),
                      'stop_preserve':sum(x['action']=='stop-preserve-container' for x in candidates.values()),'unknown':len(unknown)}),flush=True)
    if not args.apply:
        raise SystemExit(0)
    backup=OUT/('retirement-private-'+uuid.uuid4().hex[:8]);backup.mkdir()
    if os.name=='nt':
        sid=list(csv.reader(run(['whoami','/user','/fo','csv','/nh']).decode().splitlines()))[0][1]
        run(['icacls',str(backup),'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'])
    (backup/'containers.private.json').write_text(json.dumps(cs,indent=2),encoding='utf-8')
    # CLI Edge main service is generated in the container, not the readonly
    # function bind. Preserve it privately before retiring that container.
    for c in cs:
        if c['Id'] in candidates and candidates[c['Id']]['action']=='remove-stateless' and c['Name'].startswith('/supabase_edge_runtime_'):
            p=subprocess.run(['docker','cp',c['Id']+':/root/index.ts',str(backup/(c['Id']+'-edge-main.ts'))],capture_output=True)
            if p.returncode:
                raise RuntimeError('Could not archive generated Edge main configuration; nothing removed')
    # Configuration copies remain private, including any existing local env files.
    directories={Path((c['Config'].get('Labels') or {})['com.supabase.cli.workdir']).resolve()
                 for c in cs if c['Id'] in candidates and (c['Config'].get('Labels') or {}).get('com.supabase.cli.workdir')}
    for i,directory in enumerate(sorted(directories)):
        dest=backup/('project-'+str(i));dest.mkdir()
        for filename in ('config.toml','.env'):
            source=directory/'supabase'/filename
            if source.exists():shutil.copyfile(source,dest/filename)
    # Record the complete allowlist/reasons before the first mutation.
    (backup/'plan.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
    current={c['Id']:c for c in inspect_all()}
    assert all(id in current and current[id]['Name'].lstrip('/')==row['name'] for id,row in candidates.items())
    stop=[id for id in candidates if current[id]['State']['Running']]
    # Stop stateless clients before database/volume holders. No force removal.
    stop.sort(key=lambda id:candidates[id]['action']!='remove-stateless')
    for i in range(0,len(stop),20):
        run(['docker','stop','--time','10',*stop[i:i+20]])
        print('Stopped batch '+str(i//20+1)+'; data/config retained',flush=True)
    current={c['Id']:c for c in inspect_all()}
    remove=[id for id,row in candidates.items() if row['action']=='remove-stateless']
    for id in remove:
        c=current[id]
        assert not c['State']['Running']
        assert c['Mounts']==next(x for x in cs if x['Id']==id)['Mounts'], 'Mount configuration changed since review'
    for i in range(0,len(remove),30):
        run(['docker','rm',*remove[i:i+30]])
    final=inspect_all()
    assert {c['Id'] for c in cs}-{c['Id'] for c in final}==set(remove)
    assert all(next(x for x in final if x['Id']==p['Id'])['State']['Running'] for p in primary)
    plan.update({'after':len(final),'running_after':sum(c['State']['Running'] for c in final),
                 'removed_ids':remove,'private_backup':str(backup)})
    (OUT/'retirement-result.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
    print('RESULT '+str(len(cs))+' -> '+str(len(final))+' containers; '+str(plan['running_after'])+' running. Primary preserved; no databases/volumes/images/networks removed.',flush=True)
