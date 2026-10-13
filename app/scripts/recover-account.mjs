// Ręczna naprawa konta po awarii Auth/SQL. Nie uruchamia się w aplikacji.
import { assertBranch, assertSafeConfig, management, readLocalEnv, server } from './accounts-admin.mjs';
try {
  assertBranch(); assertSafeConfig(await management('/config/auth'));
  const c = readLocalEnv('.env.account-recovery');
  if (c.SLM_RECOVERY_CONFIRM !== 'RESET_STALE_OPERATION' ||
      !/^[0-9a-f-]{36}$/i.test(c.SLM_RECOVERY_USER_ID ?? '') ||
      !/^[0-9a-f-]{36}$/i.test(c.SLM_RECOVERY_OPERATION_ID ?? '') ||
      !c.SLM_RECOVERY_PASSWORD || c.SLM_RECOVERY_PASSWORD.length < 8 || Buffer.byteLength(c.SLM_RECOVERY_PASSWORD) > 72)
    throw new Error('Brak lokalnej konfiguracji');
  const api = await server();
  const op = await api.request('/rest/v1/rpc/slm_account_prepare_recovery','POST',{
    p_user:c.SLM_RECOVERY_USER_ID,p_expected_operation:c.SLM_RECOVERY_OPERATION_ID,
  });
  if (!op.ok) throw new Error('Niewłaściwa lub za świeża operacja');
  const auth = await api.request('/auth/v1/admin/users/'+c.SLM_RECOVERY_USER_ID,'PUT',{password:c.SLM_RECOVERY_PASSWORD});
  if (!auth.ok) throw new Error('Konto pozostaje zablokowane');
  const done = await api.request('/rest/v1/rpc/slm_account_finish','POST',{
    p_user:c.SLM_RECOVERY_USER_ID,p_operation:op.data,
  });
  if (!done.ok || !done.data) throw new Error('Konto pozostaje zablokowane');
  console.log('OK: naprawiono konto. Wymagana zmiana hasła z lokalnej konfiguracji. Stare sesje odrzucone.');
} catch {
  console.log('BLOKADA naprawy: sprawdź konfigurację, UUID operacji i wiek powyżej 10 minut. Nie odblokowuj konta samym SQL.');
  process.exitCode=1;
}
