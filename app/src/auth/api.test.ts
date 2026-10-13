import { afterEach, expect, test, vi } from 'vitest';
import { accountRequest } from './api';
afterEach(() => vi.unstubAllGlobals());
test('zachowuje kod odmowy serwera, potrzebny do usunięcia starej sesji', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'session_invalid',error:'Sesja wygasła.'}),{status:401})));
  await expect(accountRequest('profile')).rejects.toMatchObject({code:'session_invalid'});
});
test('błąd sieci pokazuje bez danych technicznych i sekretów', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('wewnętrzna przyczyna')));
  await expect(accountRequest('profile')).rejects.toMatchObject({code:'network_error',message:'Brak połączenia. Sprawdź internet i spróbuj ponownie.'});
});
