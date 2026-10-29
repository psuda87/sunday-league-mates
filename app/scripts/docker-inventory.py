"""Read-only Docker metadata inventory. Never captures Env/Cmd/logs or changes resources."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True, encoding='utf-8')


def lines(*args):
    return [json.loads(s) for s in docker(*args, '--format', '{{json .}}').splitlines() if s]


def inspect(kind, ids):
    result = []
    for offset in range(0, len(ids), 40):
        result.extend(json.loads(docker(kind, 'inspect', *ids[offset:offset + 40])))
    return result


def labels(value):
    return {k: v for k, v in (value or {}).items()
            if k in ('slm.fixture', 'com.docker.compose.project',
                     'com.supabase.cli.project', 'com.supabase.cli.workdir')}


def snapshot():
    context = docker('context', 'show').strip()
    endpoint = os.environ.get('DOCKER_HOST') or docker('context', 'inspect', '--format', '{{.Endpoints.docker.Host}}').strip()
    if not endpoint.startswith(('npipe://', 'unix://')):
        raise RuntimeError('Local Docker socket required; remote contexts are out of scope')
    containers = []
    ids = docker('ps', '-aq').split()
    for offset in range(0, len(ids), 40):
        for d in json.loads(docker('inspect', *ids[offset:offset + 40])):
            containers.append({
                'id': d['Id'], 'name': d['Name'].lstrip('/'),
                'image': d['Config']['Image'], 'image_id': d['Image'],
                'status': d['State']['Status'], 'running': d['State']['Running'],
                'created': d['Created'], 'labels': labels(d['Config'].get('Labels')),
                'ports': d['HostConfig'].get('PortBindings') or {},
                'network_mode': d['HostConfig']['NetworkMode'],
                'networks': list(d['NetworkSettings']['Networks']),
                'mounts': [{k: m.get(k) for k in ('Type', 'Name', 'Source', 'Destination', 'RW')}
                           for m in d['Mounts']],
                'volumes_from': d['HostConfig'].get('VolumesFrom'),
                'links': d['HostConfig'].get('Links'),
            })
    images = lines('images', '--no-trunc', '--digests')
    volumes = []
    for v in inspect('volume', docker('volume', 'ls', '-q').split()):
        volumes.append({k: v.get(k) for k in ('Name', 'Driver', 'Mountpoint', 'Scope')} |
                       {'labels': labels(v.get('Labels')),
                        'used_by': [c['name'] for c in containers
                                    if any(m.get('Name') == v['Name'] for m in c['mounts'])]})
    networks = []
    for n in inspect('network', docker('network', 'ls', '-q').split()):
        networks.append({k: n.get(k) for k in ('Name', 'Id', 'Driver', 'Scope', 'Internal')} |
                        {'labels': labels(n.get('Labels')),
                         'attached_containers': [v['Name'] for v in (n.get('Containers') or {}).values()]})
    return {'captured_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'docker_context': context, 'transport': 'local socket',
            'containers': containers, 'images': images, 'volumes': volumes, 'networks': networks}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    # Read all requested resources before writing the local inventory files.
    result = snapshot()
    disk = docker('system', 'df', '-v')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    args.output.with_suffix('.df.txt').write_text(disk, encoding='utf-8')
    print(json.dumps({'containers': len(result['containers']),
                      'running': sum(c['running'] for c in result['containers']),
                      'images': len(result['images']), 'volumes': len(result['volumes']),
                      'networks': len(result['networks'])}))
