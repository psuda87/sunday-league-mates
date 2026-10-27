import { accountRequest,AccountError } from './api';
import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
import { AccountUiFailure } from '../account-ui/model';
import type { AccountUiPort } from '../account-ui/model';

// Existing SessionManager only; candidate signup requires explicit opt-in. No demo Auth.
export function b1Port(manager:SessionManager,accountModel=false,request=accountRequest,challenge?:(requestId:string)=>Promise<string>):AccountUiPort {
 const existing=legacyAccountUiAdapter(manager);
 let signupAttempt:{id:string;secret:string;payload:string}|null=null;
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
  signUp:accountModel?async(profile,email,password)=>{
   const payload=JSON.stringify([profile.nickname,email,profile.phone,profile.fullName]);
   if(!signupAttempt||signupAttempt.payload!==payload)signupAttempt={payload,id:crypto.randomUUID(),secret:Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('')};
   const token=challenge?await challenge(signupAttempt.id):undefined;
   let result:{registered:boolean;user_id:string;nickname:string}|undefined;
   await translate(async()=>{result=await request('model_signup',{...(token?{challenge_token:token}:{}),nickname:profile.nickname,email,password,phone:profile.phone,full_name:profile.fullName,request_id:signupAttempt!.id,request_secret:signupAttempt!.secret});});
   if(!result||!result.registered||typeof result.user_id!=='string'||typeof result.nickname!=='string')throw new AccountUiFailure('integration');
   await manager.signIn(result.nickname,password,result.user_id);signupAttempt=null;
  }:unsupported,resendVerification:unsupported,requestPasswordReset:accountModel?email=>translate(()=>request('model_recovery_request',{email})):unsupported,
  completeRedirect:unsupported,saveProfile:unsupported,
 };
}
