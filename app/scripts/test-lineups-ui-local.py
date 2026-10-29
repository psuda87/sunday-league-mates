"""Stage2B browser -> existing SessionManager -> real isolated Stage2A backend.
No published Docker ports; a temporary loopback-only HTTP bridge forwards solely
accounts requests into network-none. No credentials are written to files/logs.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import subprocess
import threading

spec = importlib.util.spec_from_file_location('lineups_edge_fixture', Path(__file__).with_name('test-lineups-edge-local.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


def verify_ui(users, group):
    a, b = users[1:3]
    event = fixture.write(a, 'matches_create', group_id=group, name='Stage2B UI fixture', visibility='private',
                          date='2099-01-01', time='18:00', location='Fictional local pitch', duration_minutes=90, capacity=15, cost_cents=0)['event_id']
    for user in [a, b]:
        fixture.write(user, 'matches_join', event_id=event)
    for i in range(9):
        fixture.write(a, 'matches_guest', event_id=event, guest_name='Gość UI ' + str(i), list='registered')

    class Bridge(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log request headers/bodies/credentials.

        def do_POST(self):
            if self.path != '/functions/v1/accounts' or int(self.headers.get('Content-Length', '0')) > 12288:
                self.send_error(400)
                return
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            token = self.headers.get('Authorization', '').removeprefix('Bearer ')
            status, data, _ = fixture.http(9000, self.path, body, token)
            wire = json.dumps(data).encode('utf-8')
            try:
                self.send_response(status or 503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(wire)))
                self.end_headers()
                self.wfile.write(wire)
            except (BrokenPipeError, ConnectionResetError):
                pass  # Browser may cancel a read when the editor unmounts.

    bridge = ThreadingHTTPServer(('127.0.0.1', 0), Bridge)
    thread = threading.Thread(target=bridge.serve_forever, daemon=True)
    thread.start()
    bootstrap = {'proxy': 'http://127.0.0.1:' + str(bridge.server_port), 'eventId': event, 'groupId': group,
                 'users': [{'id': u['id'], 'refresh': u['session']['refresh_token']} for u in [a, b]]}
    try:
        run = subprocess.run(['node', 'app/scripts/test-lineups-ui-browser.mjs'], cwd=fixture.ROOT,
                             input=json.dumps(bootstrap), text=True, encoding='utf-8', capture_output=True, timeout=300)
        # Browser stdout contains check labels only, never the bootstrap/session.
        print(run.stdout, end='', flush=True)
        if run.returncode:
            raise AssertionError('Real UI runner failed: ' + run.stderr[-2000:])
        fixture.check(fixture.sql("select count(*) from public.slm_match_lineups where event_id='" + event + "'") == '1',
                      'browser saves persist exactly one shared lineup row')
    finally:
        bridge.shutdown()
        bridge.server_close()
        thread.join(timeout=5)


if __name__ == '__main__':
    try:
        fixture.main(verify_ui)
    finally:
        for name in reversed(fixture.started):
            subprocess.run(['docker', 'stop', '--timeout', '5', name], capture_output=True, timeout=25)
        if fixture.started:
            print('Stopped and retained real UI fixture: ' + fixture.NAME, flush=True)
