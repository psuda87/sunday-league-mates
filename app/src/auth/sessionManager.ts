import { AccountError } from './api';
import type { Session } from './api';
import type { TokenStore } from './tokenStore';

export type SessionPhase = 'checking' | 'ready' | 'signed_out' | 'unavailable' | 'storage_error';
export interface SessionState { phase: SessionPhase; session: Session | null; message: string }
export type RequestAccount = <T>(action: string, values?: Record<string, unknown>, session?: Session | null) => Promise<T>;
export type EmailAction = 'signup'|'resend_verification'|'recover_email'|'verify_email'|'recover_password';
const signedOut = (): SessionState => ({ phase: 'signed_out', session: null, message: '' });
const unavailableMessage = 'Nie można teraz sprawdzić sesji. Połącz się z internetem i spróbuj ponownie.';
function validate(value: Session) {
  if (!value || typeof value.access_token !== 'string' || !value.access_token ||
    typeof value.refresh_token !== 'string' || !value.refresh_token || value.refresh_token.length > 4096 ||
    !Number.isFinite(value.expires_in) || value.expires_in <= 0 || typeof value.user_id !== 'string' ||
    !['admin', 'member'].includes(value.role) || typeof value.must_change_password !== 'boolean')
    throw new AccountError('Serwer nie potwierdził sesji. Spróbuj ponownie.', 'server_error');
}

export class SessionManager {
  private state: SessionState = { phase: 'checking', session: null, message: '' };
  private listeners = new Set<() => void>();
  private current: Session | null = null;
  private expiresAt = 0;
  private generation = 0;
  private refreshFlight: Promise<void> | null = null;
  private mutation: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private store: TokenStore, private request: RequestAccount, private now = () => Date.now()) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  // Anonymous email operations can acknowledge a proof, NEVER adopt a URL session.
  // The only routes into ready remain password login / server-verified refresh.
  async emailAction(action:EmailAction,values:Record<string,unknown>):Promise<void>{
    if(this.state.phase!=='signed_out')throw new AccountError('Najpierw zakończ bieżącą sesję.','access_unavailable');
    const generation=this.generation;
    const result=await this.request<Record<string,unknown>>(action,values);
    if(generation!==this.generation)throw new AccountError('Operacja została przerwana.','session_invalid');
    const key=action==='verify_email'?'email_verified':action==='recover_password'?'password_changed':'verification_required';
    if(!result||result[key]!==true||'access_token' in result||'refresh_token' in result)
      throw new AccountError('Serwer nie potwierdził operacji.','server_error');
  }
  private publish(state: SessionState) { this.state = state; this.listeners.forEach(listener => listener()); }
  suspend() {
    if (this.state.phase === 'ready') this.publish({ phase: 'checking', session: null, message: '' });
  }
  private persist(operation: () => Promise<void>, generation: number) {
    const next = this.writes.catch(() => undefined).then(async () => {
      if (generation === this.generation) await operation();
    });
    this.writes = next;
    return next;
  }
  private async accept(session: Session, generation: number) {
    validate(session);
    if (generation !== this.generation) return;
    this.current = session;
    this.expiresAt = this.now() + session.expires_in * 1000;
    await this.persist(() => this.store.write(session.refresh_token), generation);
    if (generation === this.generation) this.publish({ phase: 'ready', session, message: '' });
  }
  private async problem(error: unknown, generation: number) {
    if (generation !== this.generation) return;
    if (error instanceof AccountError && error.code === 'session_invalid') {
      this.current = null;
      try { await this.persist(() => this.store.clear(), generation); }
      catch { this.publish({ phase: 'storage_error', session: null, message: 'Nie można usunąć zapisanej sesji. Ponów wylogowanie.' }); return; }
      if (generation === this.generation) this.publish({ ...signedOut(), message: 'Sesja wygasła lub została cofnięta. Zaloguj się ponownie.' });
    } else {
      const storage = error instanceof AccountError && error.code === 'storage_error';
      this.publish({ phase: storage ? 'storage_error' : 'unavailable', session: null,
        message: storage ? error.message : unavailableMessage });
    }
  }
  // Jeden refresh naraz: rotacja nie może zużyć równolegle tego samego tokenu.
  refresh = (): Promise<void> => {
    if (this.mutation) return this.mutation.then(() => this.refresh(), () => this.refresh());
    if (this.refreshFlight) return this.refreshFlight;
    const generation = this.generation;
    this.publish({ phase: 'checking', session: null, message: '' });
    const flight = (async () => {
      try {
        const token = this.current?.refresh_token ?? await this.store.read();
        if (generation !== this.generation) return;
        if (!token) { this.publish(signedOut()); return; }
        // Serwer wykonuje Auth refresh i sprawdza żywą sesję/wersję/rolę/blokadę SQL.
        const session = await this.request<Session>('refresh', { refresh_token: token });
        await this.accept(session, generation);
      } catch (error) { await this.problem(error, generation); }
    })();
    this.refreshFlight = flight;
    void flight.finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; });
    return flight;
  };
  signIn(identifier: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.refreshFlight = null;
    this.publish({ phase: 'checking', session: null, message: '' });
    const flight = (async () => { try {
      const session = await this.request<Session>('login', { identifier, password });
      await this.accept(session, generation);
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof AccountError && error.code === 'invalid_credentials') this.publish(signedOut());
        else await this.problem(error, generation);
      }
      throw error;
    } })().finally(() => { if (this.mutation === flight) this.mutation = null; });
    this.mutation = flight;
    return flight;
  }
  // Zmiana hasła/aliasów zwraca już zweryfikowaną, nową sesję.
  changeSession(action: 'password' | 'identifiers', values: Record<string, unknown>): Promise<void> {
    const generation = this.generation;
    const flight = (async () => {
      const session = await this.call<Session>(action, values);
      try { await this.accept(session, generation); }
      catch (error) { await this.problem(error, generation); throw error; }
    })().finally(() => { if (this.mutation === flight) this.mutation = null; });
    this.mutation = flight;
    return flight;
  }
  async call<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
    if (this.current && this.expiresAt - this.now() < 60000) await this.refresh();
    if (this.state.phase !== 'ready' || !this.current) throw new AccountError(unavailableMessage, 'access_unavailable');
    const generation = this.generation;
    try {
      const result = await this.request<T>(action, values, this.current);
      if (generation !== this.generation) throw new AccountError('Sesja została zakończona.', 'session_invalid');
      return result;
    } catch (error) {
      if (error instanceof AccountError && ['session_invalid', 'network_error', 'service_unavailable', 'server_error'].includes(error.code))
        await this.problem(error, generation);
      throw error;
    }
  }
  async logout() {
    const session = this.current;
    const generation = ++this.generation;
    this.current = null; this.refreshFlight = null;
    this.publish({ phase: 'checking', session: null, message: '' });
    let localError: unknown;
    try { await this.persist(() => this.store.clear(), generation); }
    catch (error) { localError = error; }
    // Zdalny logout może być niedostępny offline; lokalne usunięcie jest obowiązkowe.
    let remoteError = false;
    if (session) {
      try { await this.request('logout', {}, session); }
      catch { remoteError = true; }
    }
    if (generation !== this.generation) return;
    if (localError) {
      this.publish({ phase: 'storage_error', session: null, message: 'Nie można usunąć zapisanej sesji. Ponów wylogowanie.' });
      throw new AccountError('Nie można usunąć zapisanej sesji.', 'storage_error');
    }
    this.publish({ ...signedOut(), message: remoteError ? 'Wylogowano lokalnie. Serwer nie potwierdził zakończenia sesji.' : '' });
  }
}
