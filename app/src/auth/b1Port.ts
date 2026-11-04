import { AccountError } from './api';
import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
import { AccountUiFailure } from '../account-ui/model';
import type { AccountUiPort } from '../account-ui/model';
import type { EmailCallback,LegalDocuments } from './emailCallback';
import { normalizeEmail,profileProblems } from '../account-ui/model';

// Existing accounts + SessionManager only; no demo reducer or second Auth client.
export function b1Port(manager:SessionManager,options:{callback?:EmailCallback|null;legal?:LegalDocuments}={}):AccountUiPort & {discardProof:()=>void} {
 const existing=legacyAccountUiAdapter(manager);
 const unsupported=async()=>{throw new AccountUiFailure('integration');};
 let email='';
 const incoming=options.callback?.kind==='proof'?options.callback:null;
 let proof=incoming?{intent:incoming.intent,tokenHash:incoming.tokenHash}:null;
 let inFlight=false;
 async function emailWork(operation:()=>Promise<void>){
  if(inFlight)throw new AccountError('Operacja jest już w toku.','operation_pending');
  if(incoming)incoming.tokenHash='';
  inFlight=true;try{await translate(operation);}finally{inFlight=false;}
 }
 async function translate(operation:()=>Promise<unknown>){
  try {await operation();} catch(error){
   if(error instanceof AccountError){
    if(['network_error','service_unavailable','server_error'].includes(error.code))throw new AccountUiFailure('network');
    if(['invalid_credentials','credentials_invalid','login_failed'].includes(error.code))throw new AccountUiFailure('credentials');
    if(error.code==='invalid_email_link')throw new AccountUiFailure('link');
   }
   throw error;
  }
 }
 return {
  signIn:(identifier,password)=>translate(()=>existing.signIn(identifier,password)),
  discardProof:()=>{proof=null;if(incoming)incoming.tokenHash='';},
  signOut:()=>{proof=null;email='';return existing.signOut();},restoreSession:existing.restoreSession,
  updatePassword:(password,current)=>current?translate(()=>existing.updatePassword(current,password)):emailWork(async()=>{
   if(proof?.intent!=='recovery')throw new AccountUiFailure('link');
   const hash=proof.tokenHash;proof=null;
   await manager.emailAction('recover_password',{token_hash:hash,new_password:password});
  }),
  signUp:(profile,address,password)=>emailWork(async()=>{
   if(!options.legal)throw new AccountError('Rejestracja oczekuje na zatwierdzone dokumenty.','policies_unconfigured');
   if(profileProblems(profile).length)throw new AccountError('Sprawdź dane profilu.','invalid_input');
   email=normalizeEmail(address);
   await manager.emailAction('signup',{email,password,profile:{nickname:profile.nickname,fullName:profile.fullName,phone:profile.phone,jerseyNumber:profile.jerseyNumber},accept_policies:true});
  }),
  resendVerification:()=>emailWork(async()=>{
   if(!email)throw new AccountError('Wróć do rejestracji lub logowania.','invalid_input');
   await manager.emailAction('resend_verification',{email});
  }),
  requestPasswordReset:address=>emailWork(()=>manager.emailAction('recover_email',{email:normalizeEmail(address)})),
  completeRedirect:intent=>emailWork(async()=>{
   if(intent!=='verify'||proof?.intent!==intent)throw new AccountUiFailure('link');
   const hash=proof.tokenHash;proof=null;
   await manager.emailAction('verify_email',{token_hash:hash});
  }),
  saveProfile:unsupported,
 };
}
