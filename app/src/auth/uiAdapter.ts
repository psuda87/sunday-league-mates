import type { SessionManager } from './sessionManager';
import type { Profile } from './api';
// Binding to the EXISTING accounts contract. Never included in the isolated demo.
// Legacy methods remain unchanged; email proof operations live in b1Port and
// SessionManager.emailAction against the same accounts function.
export function legacyAccountUiAdapter(manager:SessionManager) {
 return {
  identityKind:'login-or-phone' as const,
  capabilities:{selfRegistration:false,emailVerification:false,emailRecovery:false} as const,
  signIn:(identifier:string,password:string)=>manager.signIn(identifier,password),
  signOut:()=>manager.logout(),restoreSession:()=>manager.refresh(),
  updatePassword:(currentPassword:string,newPassword:string)=>manager.changeSession('password',{current_password:currentPassword,new_password:newPassword}),
  readProfile:()=>manager.call<Profile>('profile'),
  saveProfile:(fullName:string,displayAs:'nickname'|'first_name'|'full_name')=>manager.call<Profile>('save_profile',{full_name:fullName,display_as:displayAs}),
 };
}
