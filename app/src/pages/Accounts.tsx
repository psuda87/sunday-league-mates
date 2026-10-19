import LiveGroups from '../live/Groups';
import LiveMatches from '../live/Matches';
import GroupFinance from '../live/Finance';
import { AccountHeading, PasswordField, SignInFields } from '../account-ui/Fields';
import Players from '../ui/Players';
import { notificationsOutline } from 'ionicons/icons';
import AppearanceSettings from '../ui/AppearanceSettings';
import BottomNav from '../ui/BottomNav';
import PhoneInput from '../components/PhoneInput';
import { normalizePolishPhone, normalizePhoneUpdate, nationalPhone } from '../../supabase/functions/_shared/phone';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonContent, IonInput, IonItem, IonPage, IonSelect,
  IonSelectOption, IonSpinner, IonFooter, IonIcon } from '@ionic/react';
import { AccountError, accountRequest } from '../auth/api';
import type { ManagedAccount, Profile } from '../auth/api';
import { SessionManager } from '../auth/sessionManager';
import { tokenStore } from '../auth/tokenStore';
import './Accounts.css';
import Events from './Events';
import Settlements from './Settlements';
import Notifications from './Notifications';
import { NativePush } from '../notifications/nativePush';
import type { NotificationItem } from '../notifications/model';

export default function Accounts() {
  const [manager] = useState(() => new SessionManager(tokenStore, accountRequest));
  const auth = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const session = auth.session;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<'profile' | 'admin' | 'events' | 'notifications' | 'settlements' | 'players' | 'groups' | 'legacy-events' | 'legacy-finance'>('events');
  const [eventTarget, setEventTarget] = useState<string | null>(null);
  const [eventsViewVersion, setEventsViewVersion] = useState(0);
  const [pendingNotification, setPendingNotification] = useState<string | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const [pushStatus, setPushStatus] = useState('Systemowy push jest opcjonalny.');
  const [push] = useState(() => new NativePush(manager,setPendingNotification,
    () => setNotificationVersion(v => v+1),setPushStatus));
  const busyFlight=useRef(false);
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
    if(busyFlight.current)return;busyFlight.current=true;
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { failed(e); } finally { busyFlight.current=false;setBusy(false); }
  }
  async function logout() { await push.beforeLogout(); await manager.logout(); }
  const openNotification = useCallback(async (id: string) => {
    // Cel pochodzi z własnego rekordu bazy, nigdy bezpośrednio z payloadu FCM.
    const notification = await manager.call<NotificationItem>('notifications_open',{ notification_id: id });
    setNotificationVersion(v => v+1);
    if (notification.category === 'finance') {
      setScreen('settlements'); setTemporary(null);
    } else if (notification.match_id) {
      setEventTarget(notification.match_id); setScreen('events');
    } else if (notification.event_id) {
      setEventTarget(notification.event_id); setScreen('legacy-events');
    } else setScreen('notifications');
  },[manager]);
  useEffect(() => { void push.start(); return () => { void push.stop(); }; },[push]);
  useEffect(() => {
    if (auth.phase === 'ready' && session && !session.must_change_password) void push.resume();
    else push.pause();
  },[push,auth.phase,session]);
  useEffect(() => {
    if (auth.phase !== 'ready' || !session || session.must_change_password) { setUnread(null); return; }
    let alive = true;
    const refresh = () => {
      void manager.call<{ unread: number }>('notifications_count')
        .then(r => { if (alive) setUnread(Number.isInteger(r.unread) ? r.unread : null); })
        .catch(() => { if (alive) setUnread(null); });
    };
    refresh(); const timer = window.setInterval(refresh,60000);
    return () => { alive = false; window.clearInterval(timer); };
  },[manager,auth.phase,session,notificationVersion]);
  useEffect(() => {
    if (!pendingNotification || auth.phase !== 'ready' || !session || session.must_change_password) return;
    let alive = true;
    void openNotification(pendingNotification).catch(e => { if (alive) failed(e); })
      .finally(() => { if (alive) setPendingNotification(null); });
    return () => { alive = false; };
  },[pendingNotification,auth.phase,session,openNotification,failed]);
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
      setProfile(p); setFullName(p.full_name); setDisplayAs(p.display_as); setLogin(p.login); setPhone(nationalPhone(p.phone));
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
    <PasswordField ionic label={session?.must_change_password?'Hasło tymczasowe':'Obecne hasło'} value={currentPassword} onChange={setCurrentPassword}/>
    <PasswordField ionic newPassword label="Nowe hasło" value={newPassword} onChange={setNewPassword}/>
    <PasswordField ionic newPassword label="Powtórz nowe hasło" value={confirmation} onChange={setConfirmation}/>
    <p className="slm-muted">Co najmniej 8 znaków. Użyj unikalnego hasła.</p>
    <IonButton type="submit" expand="block" disabled={busy}>Zmień hasło</IonButton>
  </form>;

  return <IonPage>
    <IonContent><main className="slm-accounts">
    {!(auth.phase === 'ready' && session && !session.must_change_password && (screen === 'events' || screen === 'players')) && <div className="slm-shell-header slm-floating-brand"><img className="slm-logo slm-crest slm-floating-crest" src="/assets/branding/slm-logo-primary-transparent.png" alt="Sunday League Mates" width="450" height="505" />
      {auth.phase === 'ready' && session && !session.must_change_password && <IonButton fill="clear" aria-label={`Powiadomienia${unread ? `, nieprzeczytane: ${unread}` : ''}`} onClick={() => setScreen('notifications')}><IonIcon icon={notificationsOutline} aria-hidden="true" /> {unread ? `(${unread})` : ''}</IonButton>}</div>}

      {error && <p role="alert" className="slm-error">⚠ {error}</p>}
      {notice && <p role="status" className="slm-notice">✓ {notice}</p>}
      {auth.message && <p role="alert" className="slm-error">⚠ {auth.message}</p>}
      {busy && <div role="status" aria-label="Trwa operacja"><IonSpinner /></div>}
      {auth.phase === 'checking' ? <section className="slm-panel" role="status"><IonSpinner /><p>Sprawdzanie sesji…</p>
        <IonButton onClick={() => void perform(logout)}>Wyloguj się</IonButton></section> :
        auth.phase === 'unavailable' || auth.phase === 'storage_error' ? <section className="slm-panel">
          <h1>Potwierdź dostęp do konta</h1><p>Chronione dane będą dostępne po sprawdzeniu sesji.</p>
          <IonButton disabled={busy} onClick={() => void perform(() => manager.refresh())}>Spróbuj ponownie</IonButton>
          <IonButton fill="outline" disabled={busy} onClick={() => void perform(logout)}>Wyloguj się</IonButton>
        </section> : !session ? <section className="slm-panel">
        <AccountHeading title="Zaloguj się">Zaloguj się e-mailem albo zachowanym loginem lub telefonem konta legacy.</AccountHeading>
        <form className="slm-form" onSubmit={event => {
          event.preventDefault(); void perform(async () => {
            await manager.signIn(identifier, loginPassword); setScreen('events');
          }).finally(() => setLoginPassword(''));
        }}>
          <SignInFields legacy identifier={identifier} password={loginPassword} onIdentifier={setIdentifier} onPassword={setLoginPassword}/>
          <IonButton expand="block" type="submit" disabled={busy}>Zaloguj się</IonButton>
        </form><p className="slm-muted">Rejestracja e-mail jest obecnie niedostępna. Nie pamiętasz hasła istniejącego konta? Skontaktuj się z administratorem aplikacji.</p>
      </section> : <>
        <nav className="slm-actions" aria-label="Konto">
          {!session.must_change_password && <IonButton fill={screen === 'settlements' ? 'solid' : 'outline'}
            onClick={() => { setScreen('settlements'); setTemporary(null); }}>Rozliczenia</IonButton>}
          {!session.must_change_password && <IonButton fill={screen === 'notifications' ? 'solid' : 'outline'}
            onClick={() => { setScreen('notifications'); setTemporary(null); }}>Powiadomienia{unread !== null && unread>0 ? ` (${unread})` : ''}</IonButton>}
          {!session.must_change_password && <IonButton fill={screen === 'events' ? 'solid' : 'outline'}
            onClick={() => { setScreen('events'); setEventTarget(null); setEventsViewVersion(v => v + 1); setTemporary(null); }}>Mecze</IonButton>}
          {!session.must_change_password && <IonButton fill={screen === 'profile' ? 'solid' : 'outline'}
            onClick={() => { setScreen('profile'); setTemporary(null); }}>Mój profil</IonButton>}
          {!session.must_change_password && session.role === 'admin' && <IonButton fill={screen === 'admin' ? 'solid' : 'outline'}
            disabled={busy} onClick={() => { setScreen('admin'); setTemporary(null); void perform(() => loadAccounts(0)); }}>Zarządzaj kontami</IonButton>}
          <IonButton fill="clear" disabled={busy} onClick={() => {
            void perform(async () => { try { await logout(); }
              finally { setProfile(null); setAccounts([]); clearSecrets(); } });
          }}>Wyloguj się</IonButton>
        </nav>
        {!session.must_change_password && screen === 'profile' && <AppearanceSettings />}
        {session.must_change_password ? <section className="slm-panel">
          <h1>Zmień hasło tymczasowe</h1><p>Przed korzystaniem z grupy ustaw własne hasło.</p>{passwordForm}
        </section> : screen === 'players' ? <Players players={[]} unavailable action={<IonButton fill="clear" aria-label={`Powiadomienia${unread ? `, nieprzeczytane: ${unread}` : ''}`} onClick={() => setScreen('notifications')}><IonIcon icon={notificationsOutline} aria-hidden="true" />{unread ? `(${unread})` : ''}</IonButton>} /> : screen === 'groups' ? <LiveGroups manager={manager} userId={session.user_id} /> : screen === 'settlements' ? <><GroupFinance manager={manager} /><IonButton fill="clear" onClick={() => setScreen('legacy-finance')}>Rozliczenia historyczne</IonButton></> : screen === 'legacy-finance' ? <Settlements manager={manager} session={session} /> : screen === 'notifications' ? <Notifications manager={manager} push={push} pushStatus={pushStatus}
          onOpen={openNotification} onRefresh={() => setNotificationVersion(v => v+1)} /> :
          screen === 'events' ? <LiveMatches key={eventsViewVersion} manager={manager} initialEventId={eventTarget} userId={session.user_id} onLegacy={() => setScreen('legacy-events')} /> : screen === 'legacy-events' ? <Events allowCreate={false} manager={manager} session={session} initialEventId={eventTarget} headerAction={<IonButton fill="clear" aria-label={`Powiadomienia${unread ? `, nieprzeczytane: ${unread}` : ''}`} onClick={() => setScreen('notifications')}><IonIcon icon={notificationsOutline} aria-hidden="true" />{unread ? `(${unread})` : ''}</IonButton>} /> : screen === 'profile' || session.role !== 'admin' ? <>
          <section className="slm-panel">
            <h1>{profile?.display_name || 'Mój profil'}</h1>
            {profile?.phone && <a className="slm-call" href={`tel:${profile.phone}`}>Zadzwoń</a>}
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
          <section className="slm-panel"><h2>{profile?.email_account ? 'Pseudonim i kontakt' : 'Login i telefon'}</h2>
            <form className="slm-form" onSubmit={event => { event.preventDefault(); void perform(async () => {
              if (profile?.email_account) {
                const p = await manager.call<Profile>('save_email_profile', { nickname: login,
                  phone: phone.trim() ? normalizePolishPhone(phone) : '', current_password: identityPassword });
                setProfile(p); setNotice('Pseudonim i kontakt zapisane.');
              } else {
                await manager.changeSession('identifiers', { login, phone: normalizePhoneUpdate(phone, profile?.phone), current_password: identityPassword });
                setNotice('Login i telefon zostały zapisane. Poprzednie sesje wylogowano.');
              }
            }).finally(() => setIdentityPassword('')); }}>
              <IonInput label="Login/pseudonim" labelPlacement="stacked" required value={login}
                onIonInput={e => setLogin(e.detail.value ?? '')} />
              <PhoneInput label="Numer telefonu" value={phone} onChange={setPhone} />
              <IonInput label="Obecne hasło" labelPlacement="stacked" type="password" autocomplete="current-password" required
                value={identityPassword} onIonInput={e => setIdentityPassword(e.detail.value ?? '')} />
              <p className="slm-muted">{profile?.email_account ? 'Telefon kontaktowy jest opcjonalny. Logujesz się e-mailem.' : 'Numer służy do logowania i kontaktu w grupie.'} Nie wysyłamy SMS-ów.</p>
              <IonButton type="submit" disabled={busy}>{profile?.email_account ? 'Zapisz pseudonim i kontakt' : 'Zmień login i telefon'}</IonButton>
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
              const result = await manager.call<{ temporary_password: string }>('create_account', { login: createLogin, phone: normalizePolishPhone(createPhone) });
              setTemporary(result.temporary_password); setCreateLogin(''); setCreatePhone(''); await loadAccounts();
            }); }}>
              <IonInput label="Login/pseudonim zawodnika" labelPlacement="stacked" required value={createLogin}
                onIonInput={e => setCreateLogin(e.detail.value ?? '')} />
              <PhoneInput label="Numer telefonu zawodnika" value={createPhone} onChange={setCreatePhone} />
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
    {auth.phase === 'ready' && session && !session.must_change_password && <IonFooter><BottomNav active={screen} onSelect={value => { setScreen(value); setTemporary(null); if (value === 'events') { setEventTarget(null); setEventsViewVersion(v => v + 1); } }} /></IonFooter>}
  </IonPage>;
}
