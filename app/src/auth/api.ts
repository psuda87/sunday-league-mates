export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  role: 'member' | 'admin';
  must_change_password: boolean;
}
export interface Profile {
  email_account?: boolean;
  user_id: string;
  login: string;
  phone: string;
  full_name: string;
  display_as: 'nickname' | 'full_name';
  display_name: string;
}
export interface ManagedAccount extends Profile {
  role: 'member' | 'admin';
  must_change_password: boolean;
  operation_pending: boolean;
}
export class AccountError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
const endpoint = import.meta.env.VITE_SLM_FUNCTION_URL ||
  'https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts';

export async function accountRequest<T>(action: string, values: Record<string, unknown> = {}, session?: Session | null): Promise<T> {
  let response: Response;
  try {
    const requestUrl=action==='profile_photo_upload'?endpoint+(endpoint.includes('?')?'&':'?')+'photo=upload':endpoint;
    response = await fetch(requestUrl, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }, body: JSON.stringify({ ...values, action }), signal: AbortSignal.timeout(20000) });
  } catch { throw new AccountError('Brak połączenia. Sprawdź internet i spróbuj ponownie.', 'network_error'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new AccountError(data?.error || 'Nie udało się wykonać operacji.', data?.code || 'server_error');
  return data as T;
}
