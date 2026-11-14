"""Render the EXISTING Premium entry. Controlled HTTP transport, NOT Supabase E2E.

Requires Python Playwright and a system Chromium. No Cloud, credentials or database.
The temporary test build has explicit fixture legal links; it is never published.
"""
import asyncio
import functools
import http.server
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import threading
from playwright.async_api import async_playwright

APP = Path(__file__).resolve().parents[1]
OUT = APP.parent / 'docs/ui/auth-web'
ACCOUNTS = 'https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts'


async def run():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='slm-email-ui-') as tmp:
        target = Path(tmp) / 'dist'
        code = f"""
        import {{build,loadConfigFromFile}} from {json.dumps((APP/'node_modules/vite/dist/node/index.js').as_uri())};
        import {{premiumWebConfig}} from {json.dumps((APP/'scripts/build-premium-web.mjs').as_uri())};
        const base=await loadConfigFromFile({{command:'build',mode:'production'}},{json.dumps(str(APP/'vite.b1.config.ts'))});
        const c=premiumWebConfig(base.config,{{VITE_SLM_TERMS_URL:'https://legal.example.invalid/terms',VITE_SLM_PRIVACY_URL:'https://legal.example.invalid/privacy'}});
        c.build.outDir={json.dumps(str(target))};await build(c);
        """
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=APP, check=True, capture_output=True)
        headers = json.loads((APP/'vercel.json').read_text())['headers'][0]['headers']

        class Handler(http.server.SimpleHTTPRequestHandler):
            def do_GET(self):
                if self.path.split('#')[0].split('?')[0] == '/auth/callback':
                    self.path = '/index.html'
                super().do_GET()

            def end_headers(self):
                for header in headers:
                    self.send_header(header['key'], header['value'])
                super().end_headers()

            def log_message(self, *_args):
                pass  # Never write callback URLs to a test access log.

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(target)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = 'http://127.0.0.1:'+str(server.server_port)
        actions, unexpected, errors = [], [], []
        state = {'mode': 'ok'}
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(executable_path=os.environ.get('SLM_CHROMIUM') or shutil.which('chromium'), args=['--no-sandbox'], headless=True)
                context = await browser.new_context(viewport={'width': 390, 'height': 844})

                async def route(request):
                    r = request.request
                    if r.url.startswith(origin+'/'):
                        await request.continue_()
                        return
                    if r.url != ACCOUNTS:
                        unexpected.append(r.url.split('?')[0].split('#')[0])
                        await request.abort()
                        return
                    cors = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin,
                            'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization'}
                    if r.method == 'OPTIONS':
                        await request.fulfill(status=204, headers=cors)
                        return
                    body = r.post_data_json
                    action = body['action']
                    actions.append(action)  # Never retain passwords or email proofs in reports.
                    if state['mode'] == 'offline':
                        await request.abort()
                        return
                    if action == 'login':
                        await request.fulfill(status=401, headers=cors, body=json.dumps({'code': 'invalid_credentials', 'error': 'Odmowa'}))
                        return
                    if state['mode'] == 'expired':
                        await request.fulfill(status=400, headers=cors, body=json.dumps({'code': 'invalid_email_link', 'error': 'Odmowa'}))
                        return
                    key = 'email_verified' if action == 'verify_email' else 'password_changed' if action == 'recover_password' else 'verification_required'
                    await request.fulfill(status=200, headers=cors, body=json.dumps({key: True}))

                await context.route('**/*', route)
                page = await context.new_page()
                page.on('pageerror', lambda e: errors.append(str(e)))

                async def fresh(path='/'):
                    await page.goto(origin+path)

                async def no_leak():
                    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
                    assert not await page.locator('.slm-demo-nav').count()
                    assert not await page.evaluate("Object.keys(localStorage).some(k=>k.startsWith('slm.auth.'))")

                await fresh()
                await page.get_by_role('heading', name='Zaloguj się', exact=True).wait_for()
                for width in (320, 390, 768):
                    await page.set_viewport_size({'width': width, 'height': 844})
                    for mode in ('dark', 'light'):
                        await page.evaluate("m=>{localStorage.setItem('slm.appearance',m);location.reload()}", mode)
                        await page.get_by_role('heading', name='Zaloguj się', exact=True).wait_for()
                        await no_leak()
                        if width == 390:
                            await page.screenshot(path=str(OUT/('login-'+mode+'.png')), full_page=True)
                await page.set_viewport_size({'width': 390, 'height': 844})
                # All palette controls and Auto still use the existing mechanism.
                await page.locator('.slm-account-appearance > summary').click()
                for palette in ('España', 'FCB', 'Classic Lime', 'Deimos-Code'):
                    await page.get_by_role('radio', name=palette, exact=True).check()
                    for mode in ('Jasny', 'Ciemny', 'Automatyczny'):
                        await page.get_by_role('radio', name=mode, exact=True).check()
                        await no_leak()
                await page.get_by_role('radio', name='España', exact=True).check()
                await page.get_by_role('radio', name='Ciemny', exact=True).check()
                await page.locator('.slm-account-appearance > summary').click()
                await page.get_by_label('E-mail lub login', exact=True).fill('fixture@example.invalid')
                password = secrets.token_urlsafe(20)
                await page.get_by_label('Hasło', exact=True).fill(password)
                await page.get_by_role('button', name='Zaloguj', exact=True).click()
                await page.get_by_role('alert').filter(has_text='Nie udało się zalogować').wait_for()
                assert await page.get_by_label('Hasło', exact=True).input_value() == ''

                await page.get_by_role('button', name='Nie masz konta? Zarejestruj się').click()
                await page.get_by_label('Nazwa zawodnika / pseudonim', exact=True).fill('Zawodnik testowy')
                await page.get_by_label('Adres e-mail', exact=True).fill('fixture@example.invalid')
                await page.get_by_label('Hasło', exact=True).fill(password)
                await page.get_by_label('Powtórz hasło', exact=True).fill(password)
                await page.get_by_role('checkbox').check()
                await page.screenshot(path=str(OUT/'register.png'), full_page=True)
                await page.get_by_role('button', name='Zarejestruj się', exact=True).click()
                await page.get_by_role('heading', name='Potwierdź e-mail').wait_for()
                await page.get_by_role('button', name='Wyślij ponownie', exact=True).click()
                await page.get_by_role('button', name='Ponów za 30 s', exact=True).wait_for()
                await no_leak()

                proof = secrets.token_hex(32)
                await fresh('/auth/callback#type=signup&token_hash='+proof)
                await page.get_by_role('heading', name='E-mail potwierdzony', exact=True).wait_for()
                assert proof not in page.url
                await page.screenshot(path=str(OUT/'verified.png'), full_page=True)
                await page.get_by_role('button', name='Przejdź do logowania').click()
                await page.get_by_role('button', name='Nie pamiętasz hasła?', exact=True).click()
                await page.get_by_label('Adres e-mail', exact=True).fill('fixture@example.invalid')
                await page.get_by_role('button', name='Wyślij link resetujący', exact=True).click()
                await page.get_by_role('status').filter(has_text='Jeśli konto kwalifikuje').wait_for()
                await page.screenshot(path=str(OUT/'forgot.png'), full_page=True)

                for width in (320, 390, 768):
                    await page.set_viewport_size({'width': width, 'height': 844})
                    await fresh('/auth/callback#type=recovery&token_hash='+secrets.token_hex(32))
                    await page.get_by_role('heading', name='Ustaw nowe hasło').wait_for()
                    await no_leak()
                    if width == 390:
                        await page.screenshot(path=str(OUT/'recovery.png'), full_page=True)
                await page.get_by_label('Nowe hasło', exact=True).fill(password)
                await page.get_by_label('Powtórz nowe hasło', exact=True).fill(password)
                await page.get_by_role('button', name='Zapisz nowe hasło').click()
                await page.get_by_role('heading', name='Zmiana hasła', exact=True).wait_for()
                await no_leak()

                state['mode'] = 'expired'
                await fresh('/auth/callback#type=signup&token_hash='+secrets.token_hex(32))
                await page.get_by_role('heading', name='Link niedostępny').wait_for()
                await no_leak()
                state['mode'] = 'offline'
                await fresh()
                await page.get_by_role('button', name='Nie pamiętasz hasła?', exact=True).click()
                await page.get_by_label('Adres e-mail', exact=True).fill('fixture@example.invalid')
                await page.get_by_role('button', name='Wyślij link resetujący', exact=True).click()
                await page.get_by_role('alert').filter(has_text='Brak połączenia').wait_for()
                assert not unexpected, 'Unexpected external requests'
                assert not errors, 'Browser JavaScript errors'
                assert set(actions) == {'login', 'signup', 'resend_verification', 'verify_email', 'recover_email', 'recover_password'}
                await browser.close()
                print('PASS Chromium: existing Premium; 320/390/768; registration/resend/verification/recovery, invalid link, login error, offline; 12 palette/mode controls; no URL/storage proof or external leak. CONTROLLED HTTP, NOT Cloud E2E.')
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    asyncio.run(run())
