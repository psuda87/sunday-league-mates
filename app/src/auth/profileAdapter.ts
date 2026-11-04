import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
import { profileProblems } from '../account-ui/model';
import type { IdentityDraft,PersonalProfileData } from '../ui/personalProfile';
import { normalizePhoneUpdate } from '../../supabase/functions/_shared/phone';
import { accountRequest } from './api';

export function fullNameProblem(fullName:string){
 return profileProblems({nickname:'Profil',fullName,phone:''})[0]??'';
}
export function profileAdapter(manager:SessionManager,userId:string){
 const existing=legacyAccountUiAdapter(manager);
 function validate(value:unknown):PersonalProfileData|null {
  if(value===null)return null;
  const p=value as PersonalProfileData;
  if(!p||p.user_id!==userId||typeof p.login!=='string'||!p.login.trim()||p.login.length>254||
   typeof p.phone!=='string'||p.phone.length>32||typeof p.full_name!=='string'||p.full_name.length>100||
   typeof p.display_name!=='string'||!p.display_name.trim()||p.display_name.length>254||
   !['nickname','first_name','full_name'].includes(p.display_as)||(p.jersey_number!=null&&(!Number.isInteger(p.jersey_number)||p.jersey_number<0||p.jersey_number>99)))throw new Error('profile_contract_invalid');
  // Pick only the existing contract; never project roles/metadata into the UI.
  return {...(typeof p.email_account==='boolean'?{email_account:p.email_account}:{}),...(typeof p.share_phone==='boolean'?{share_phone:p.share_phone}:{}),nickname:p.nickname,first_name:p.first_name,group_scope:p.group_scope,jersey_number:p.jersey_number??null,user_id:userId,login:p.login,phone:p.phone,full_name:p.full_name,display_as:p.display_as,display_name:p.display_name};
 }
 return {
  async deleteAccount(password:string,confirmation:string,ticket:{operation_id:string;proof:string},resume:boolean){
   if(!resume&&manager.getSnapshot().session?.user_id!==userId)throw Error('profile_owner_changed');
   const result=resume?await accountRequest<{deleted:boolean;operation_id:string}>('account_delete_resume',ticket):
    await manager.call<{deleted:boolean;operation_id:string}>('account_delete',{...ticket,current_password:password,confirmation});
   if(result.deleted!==true||result.operation_id!==ticket.operation_id)throw Error('deletion_unconfirmed');
   if(manager.getSnapshot().session?.user_id===userId)await manager.logout();
  },
  async changePhone(phone:string,currentPassword:string,share?:boolean){
   const before=validate(await existing.readProfile());
   if(!before||!currentPassword)throw Error('phone_change_requires_password');
   const normalized=phone.trim()===''?'':normalizePhoneUpdate(phone,before.phone);
   const sharing=normalized!==''&&(share??before.share_phone??false);
   if(normalized===before.phone&&sharing===before.share_phone)return before;
   if(before.email_account===false&&normalized!==before.phone){
    await manager.changeSession('identifiers',{login:before.login,phone:normalized,current_password:currentPassword});
   }
   await manager.call('save_contact_phone',{phone:normalized,share_phone:sharing,current_password:currentPassword});
   const confirmed=validate(await existing.readProfile());
   if(!confirmed||confirmed.phone!==normalized||confirmed.share_phone!==sharing||confirmed.login!==before.login)throw Error('profile_readback_mismatch');
   return confirmed;
  },
  async saveIdentity(draft:IdentityDraft){
   validate(await manager.call('save_premium_profile',draft as unknown as Record<string,unknown>));
   const result=validate(await existing.readProfile());
   if(!result||result.nickname!==draft.nickname.trim()||result.first_name!==draft.first_name.trim()||result.full_name!==draft.full_name.trim()||result.display_as!==draft.display_as||result.jersey_number!==draft.jersey_number)throw Error('profile_readback_mismatch');return result;
  },
  read:async()=>validate(await existing.readProfile()),
  async changeAlias(login:string,currentPassword:string){
   const before=validate(await existing.readProfile());
   if(!before||before.email_account!==false)throw new Error('alias_not_supported');
   await manager.changeSession('identifiers',{login:login.trim(),phone:before.phone,current_password:currentPassword});
   const confirmed=validate(await existing.readProfile());
   if(!confirmed||confirmed.login!==login.trim())throw new Error('profile_readback_mismatch');
   return confirmed;
  },
  async saveNumber(number:number){
   if(!Number.isInteger(number)||number<0||number>99)throw new Error('invalid_number');
   validate(await manager.call('save_jersey_number',{jersey_number:number}));
   const confirmed=validate(await existing.readProfile());
   if(!confirmed||confirmed.jersey_number!==number)throw new Error('profile_readback_mismatch');
   return confirmed;
  },
  async save(fullName:string,displayAs:'nickname'|'first_name'|'full_name'){
   const problem=fullNameProblem(fullName);if(problem)throw new Error('profile_validation');
   validate(await existing.saveProfile(fullName.trim(),displayAs));
   // Explicit server read-back; do not infer success from the submitted draft.
   const confirmed=validate(await existing.readProfile());
   if(!confirmed||confirmed.full_name!==fullName.trim()||confirmed.display_as!==displayAs)throw new Error('profile_readback_mismatch');
   return confirmed;
  },
 };
}
