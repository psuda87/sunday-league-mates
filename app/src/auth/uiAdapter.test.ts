import { expect, it, vi } from 'vitest';
import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
it('binds exactly the existing contract, with no invented registration or email operations',async()=>{
 const manager={signIn:vi.fn(),logout:vi.fn(),refresh:vi.fn(),changeSession:vi.fn(),call:vi.fn()} as unknown as SessionManager;
 const ui=legacyAccountUiAdapter(manager),secret=crypto.randomUUID();await ui.signIn('alias',secret);expect(manager.signIn).toHaveBeenCalledWith('alias',secret);await ui.restoreSession();expect(manager.refresh).toHaveBeenCalledOnce();await ui.updatePassword(secret,crypto.randomUUID());expect(manager.changeSession).toHaveBeenCalledWith('password',expect.objectContaining({current_password:secret}));await ui.readProfile();await ui.saveProfile('Fikcyjny','nickname');expect(manager.call).toHaveBeenCalledWith('profile');expect(manager.call).toHaveBeenCalledWith('save_profile',{full_name:'Fikcyjny',display_as:'nickname'});expect(ui.capabilities.selfRegistration).toBe(false);
});
