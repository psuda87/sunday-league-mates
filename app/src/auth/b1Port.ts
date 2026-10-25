import { AccountError } from './api';
import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
import { AccountUiFailure } from '../account-ui/model';
import type { AccountUiPort } from '../account-ui/model';

// No profile, signup, recovery, notifications or demo reducer enters real Auth.
export function b1Port(manager:SessionManager):AccountUiPort {
 const existing=legacyAccountUiAdapter(manager);
 const unsupported=async()=>{throw new AccountUiFailure('integration');};
 async function translate(operation:()=>Promise<unknown>){
  try {await operation();} catch(error){
   if(error instanceof AccountError){
    if(['network_error','service_unavailable','server_error'].includes(error.code))throw new AccountUiFailure('network');
    if(['invalid_credentials','credentials_invalid','login_failed'].includes(error.code))throw new AccountUiFailure('credentials');
   }
   throw error;
  }
 }
 return {
  signIn:(identifier,password)=>translate(()=>existing.signIn(identifier,password)),
  signOut:existing.signOut,restoreSession:existing.restoreSession,
  updatePassword:(password,current)=>current?translate(()=>existing.updatePassword(current,password)):unsupported(),
  signUp:unsupported,resendVerification:unsupported,requestPasswordReset:unsupported,
  completeRedirect:unsupported,saveProfile:unsupported,
 };
}
