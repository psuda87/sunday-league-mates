import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonPage, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { AccountError, accountRequest } from '../auth/api';
import type { ManagedAccount, Profile } from '../auth/api';
import { SessionManager } from '../auth/sessionManager';
import { tokenStore } from '../auth/tokenStore';
import './Accounts.css';
import Events from './Events';

export default function Accounts() {
  const [manager] = useState(() => new SessionManager(tokenStore, accountRequest));
  const auth = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const session = auth.session;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<'profile' | 'admin' | 'events'>('profile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayAs, setDisplayAs] = useState('nickname');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [identityPassword, setIdentityPassword] = useState('');
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [offset, setOffset] = useState(0);
  const [createLogin, setCreateLogin] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [temporary, setTemporary] = useState<string | null>(null);

  const clearSecrets = useCallback(() => {
    setLoginPassword(''); setCurrentPassword(''); setNewPassword(''); setConfirmation('');
    setIdentityPassword(''); setTemporary(null);
  }, []);
  const failed = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'Nie udało się wykonać operacji.');
    if (e instanceof AccountError && e.code === 'session_invalid') {
      setProfile(null); setAccounts([]); clearSecrets();
    }
  }, [clearSecrets]);
  async function perform(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { failed(e); } finally { setBusy(false); }
  }
  useEffect(() => { void manager.refresh(); }, [manager]);
  useEffect(() => {
    if (auth.phase !== 'ready') { setProfile(null); setAccounts([]); clearSecrets(); }
  }, [auth.phase, clearSecrets]);
  useEffect(() => {
    const retry = () => { if (manager.getSnapshot().phase !== 'signed_out') void manager.refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') retry(); else manager.suspend(); };
    const offline = () => { if (manager.getSnapshot().phase === 'ready') void manager.refresh(); };
    window.addEventListener('online', retry); window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    const listener = Capacitor.isNativePlatform() ? CapacitorApp.addListener('appStateChange', state => {
      // Schowaj dane także na czas powrotu z tła, zanim serwer potwierdzi dostęp.
      if (state.isActive) retry(); else manager.suspend();
    }) : null;
    return () => { window.removeEventListener('online', retry); window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible); void listener?.then(handle => handle.remove()); };
  }, [manager]);
  useEffect(() => {
    if (!session || session.must_change_password) { setProfile(null); return; }
    let cancelled = false;
    manager.call<Profile>('profile').then(p => {
      if (cancelled) return;
      setProfile(p); setFullName(p.full_name); setDisplayAs(p.display_as); setLogin(p.login); setPhone(p.phone);
    }).catch(e => { if (!cancelled) failed(e); });
    return () => { cancelled = true; };
  }, [session, failed, manager]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      void manager.refresh();
    }, Math.max(5000, (session.expires_in - 60) * 1000));
    return () => window.clearTimeout(timer);
  }, [session, manager]);
  async function loadAccounts(page = offset) {
    const rows = await manager.call<ManagedAccount[]>('list_accounts', { offset: page });
    setAccounts(rows); setOffset(page);
  }
  const changePassword = (event: React.FormEvent) => {
    event.preventDefault();
    void perform(async () => {
      if (newPassword !== confirmation) throw new Error('Nowe hasła muszą być takie same.');
      await manager.changeSession('password', {
        current_password: currentPassword, new_password: newPassword,
      });
      clearSecrets(); setNotice('Hasło zostało zmienione. Poprzednie sesje wylogowano.');
    }).finally(() => { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); });
  };
  const passwordForm = <form onSubmit={changePassword} className="slm-form">
    <IonInput label={session?.must_change_password ? 'Hasło tymczasowe' : 'Obecne hasło'} labelPlacement="stacked"
      type="password" autocomplete="current-password" required value={currentPassword}
      onIonInput={e => setCurrentPassword(e.detail.value ?? '')} />
    <IonInput label="Nowe hasło" labelPlacement="stacked" type="password" autocomplete="new-password" required
      minlength={8} value={newPassword} onIonInput={e => setNewPassword(e.detail.value ?? '')} />
    <IonInput label="Powtórz nowe hasło" labelPlacement="stacked" type="password" autocomplete="new-password" required
      value={confirmation} onIonInput={e => setConfirmation(e.detail.value ?? '')} />
    <p className="slm-muted">Co najmniej 8 znaków. Użyj unikalnego hasła.</p>
    <IonButton type="submit" expand="block" disabled={busy}>Zmień hasło</IonButton>
  </form>;

  return <IonPage>
    <IonHeader><IonToolbar><IonTitle>Sunday League Mates</IonTitle></IonToolbar></IonHeader>
    <IonContent><main className="slm-accounts">
      <div className="slm-brand"><span aria-hidden="true">SLM</span><p>Twoja drużyna. Twoje konto.</p></div>
      {error && <p role="alert" className="slm-error">⚠ {error}</p>}
      {notice && <p role="status" className="slm-notice">✓ {notice}</p>}
      {auth.message && <p role="alert" className="slm-error">⚠ {auth.message}</p>}
      {busy && <div role="status" aria-label="Trwa operacja"><IonSpinner /></div>}
      {auth.phase === 'checking' ? <section className="slm-panel" role="status"><IonSpinner /><p>Sprawdzanie sesji…</p>
        <IonButton onClick={() => void perform(() => manager.logout())}>Wyloguj się</IonButton></section> :
        auth.phase === 'unavailable' || auth.phase === 'storage_error' ? <section className="slm-panel">
          <h1>Potwierdź dostęp do konta</h1><p>Chronione dane będą dostępne po sprawdzeniu sesji.</p>
          <IonButton disabled={busy} onClick={() => void perform(() => manager.refresh())}>Spróbuj ponownie</IonButton>
          <IonButton fill="outline" disabled={busy} onClick={() => void perform(() => manager.logout())}>Wyloguj się</IonButton>
        </section> : !session ? <section className="slm-panel">
        <h1>Zaloguj się</h1><p className="slm-muted">Dane konta otrzymasz od administratora grupy.</p>
        <form className="slm-form" onSubmit={event => {
          event.preventDefault(); void perform(async () => {
            await manager.signIn(identifier, loginPassword); setScreen('profile');
          }).finally(() => setLoginPassword(''));
        }}>
          <IonInput label="Login lub numer telefonu" labelPlacement="stacked" autocomplete="username" required
            value={identifier} onIonInput={e => setIdentifier(e.detail.value ?? '')} />
          <IonInput label="Hasło" labelPlacement="stacked" type="password" autocomplete="current-password" required
            value={loginPassword} onIonInput={e => setLoginPassword(e.detail.value ?? '')} />
          <IonButton expand="block" type="submit" disabled={busy}>Zaloguj się</IonButton>
        </form><p className="slm-muted">Nie pamiętasz hasła? Poproś administratora o reset.</p>
      </section> : <>
        <nav className="slm-actions" aria-label="Konto">
          {!session.must_change_password && <IonButton fill={screen === 'events' ? 'solid' : 'outline'}
            onClick={() => { setScreen('events'); setTemporary(null); }}>Mecze</IonButton>}
          {!session.must_change_password && <IonButton fill={screen === 'profile' ? 'solid' : 'outline'}
            onClick={() => { setScreen('profile'); setTemporary(null); }}>Mój profil</IonButton>}
          {!session.must_change_password && session.role === 'admin' && <IonButton fill={screen === 'admin' ? 'solid' : 'outline'}
            disabled={busy} onClick={() => { setScreen('admin'); setTemporary(null); void perform(() => loadAccounts(0)); }}>Zarządzaj kontami</IonButton>}
          <IonButton fill="clear" disabled={busy} onClick={() => {
            void perform(async () => { try { await manager.logout(); }
              finally { setProfile(null); setAccounts([]); clearSecrets(); } });
          }}>Wyloguj się</IonButton>
        </nav>
        {session.must_change_password ? <section className="slm-panel">
          <h1>Zmień hasło tymczasowe</h1><p>Przed korzystaniem z grupy ustaw własne hasło.</p>{passwordForm}
        </section> : screen === 'events' ? <Events manager={manager} session={session} /> : screen === 'profile' || session.role !== 'admin' ? <>
          <section className="slm-panel">
            <h1>{profile?.display_name || 'Mój profil'}</h1>
            {profile && <a className="slm-call" href={`tel:${profile.phone}`}>Zadzwoń</a>}
            <form className="slm-form" onSubmit={event => { event.preventDefault(); void perform(async () => {
              const p = await manager.call<Profile>('save_profile', { full_name: fullName, display_as: displayAs });
              setProfile(p); setNotice('Profil zapisany.');
            }); }}>
              <IonInput label="Imię i nazwisko (opcjonalnie)" labelPlacement="stacked" maxlength={100}
                value={fullName} onIonInput={e => setFullName(e.detail.value ?? '')} />
              <IonSelect label="Wyświetlaj mnie jako" labelPlacement="stacked" value={displayAs}
                onIonChange={e => setDisplayAs(e.detail.value)}>
                <IonSelectOption value="nickname">Login/pseudonim</IonSelectOption>
                <IonSelectOption value="full_name">Imię i nazwisko</IonSelectOption>
              </IonSelect><p className="slm-muted">Bez imienia i nazwiska wyświetlimy pseudonim.</p>
              <IonButton type="submit" disabled={busy}>Zapisz profil</IonButton>
            </form>
          </section>
          <section className="slm-panel"><h2>Login i telefon</h2>
            <form className="slm-form" onSubmit={event => { event.preventDefault(); void perform(async () => {
              await manager.changeSession('identifiers', { login, phone, current_password: identityPassword });
              setNotice('Login i telefon zostały zapisane. Poprzednie sesje wylogowano.');
            }).finally(() => setIdentityPassword('')); }}>
              <IonInput label="Login/pseudonim" labelPlacement="stacked" required value={login}
                onIonInput={e => setLogin(e.detail.value ?? '')} />
              <IonInput label="Numer telefonu z prefiksem kraju" labelPlacement="stacked" type="tel" placeholder="+48…" required
                value={phone} onIonInput={e => setPhone(e.detail.value ?? '')} />
              <IonInput label="Obecne hasło" labelPlacement="stacked" type="password" autocomplete="current-password" required
                value={identityPassword} onIonInput={e => setIdentityPassword(e.detail.value ?? '')} />
              <p className="slm-muted">Numer służy do logowania i kontaktu w grupie. Nie wysyłamy SMS-ów.</p>
              <IonButton type="submit" disabled={busy}>Zmień login i telefon</IonButton>
            </form>
          </section>
          <section className="slm-panel"><h2>Zmień hasło</h2>{passwordForm}</section>
        </> : <>
          {temporary && <section className="slm-panel" role="status"><h2>Hasło tymczasowe</h2>
            <p>Przekaż je ręcznie zawodnikowi. Po zamknięciu nie będzie można go odczytać.</p>
            <p className="slm-temporary">{temporary}</p><IonButton onClick={() => setTemporary(null)}>Ukryj hasło</IonButton>
          </section>}
          <section className="slm-panel"><h1>Utwórz konto zawodnika</h1>
            <form className="slm-form" onSubmit={event => { event.preventDefault(); void perform(async () => {
              setTemporary(null);
              const result = await manager.call<{ temporary_password: string }>('create_account', { login: createLogin, phone: createPhone });
              setTemporary(result.temporary_password); setCreateLogin(''); setCreatePhone(''); await loadAccounts();
            }); }}>
              <IonInput label="Login/pseudonim zawodnika" labelPlacement="stacked" required value={createLogin}
                onIonInput={e => setCreateLogin(e.detail.value ?? '')} />
              <IonInput label="Numer telefonu zawodnika" labelPlacement="stacked" type="tel" placeholder="+48…" required
                value={createPhone} onIonInput={e => setCreatePhone(e.detail.value ?? '')} />
              <IonButton type="submit" disabled={busy}>Utwórz konto</IonButton>
            </form>
          </section>
          <section className="slm-panel"><h2>Konta w grupie</h2>
            {accounts.map(a => <IonItem key={a.user_id} lines="full"><div className="slm-managed">
              <strong>{a.display_name}</strong><p>{a.login} · {a.phone}</p>
              <p className="slm-muted">{a.role === 'admin' ? 'Administrator' : 'Zawodnik'}
                {a.operation_pending ? ' · ⚠ Operacja wymaga naprawy' : a.must_change_password ? ' · Wymagana zmiana hasła' : ''}</p>
              {a.user_id !== session.user_id && <IonButton fill="outline" disabled={busy || a.operation_pending}
                onClick={() => { if (!window.confirm(`Zresetować hasło konta ${a.login}? Poprzednie sesje zostaną wylogowane.`)) return;
                  void perform(async () => { setTemporary(null);
                    const r = await manager.call<{ temporary_password: string }>('reset_password', { user_id: a.user_id });
                    setTemporary(r.temporary_password); await loadAccounts();
                  }); }}>Resetuj hasło</IonButton>}
            </div></IonItem>)}
            <div className="slm-actions"><IonButton fill="outline" disabled={busy || offset === 0}
              onClick={() => void perform(() => loadAccounts(Math.max(0, offset - 50)))}>Poprzednie</IonButton>
              <IonButton fill="outline" disabled={busy || accounts.length < 50}
                onClick={() => void perform(() => loadAccounts(offset + 50))}>Następne</IonButton></div>
          </section>
        </>}
      </>}
    </main></IonContent>
  </IonPage>;
}
