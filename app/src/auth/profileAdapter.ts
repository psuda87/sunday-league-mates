import type { SessionManager } from './sessionManager';
import { legacyAccountUiAdapter } from './uiAdapter';
import { profileProblems } from '../account-ui/model';
import type { PersonalProfileData } from '../ui/personalProfile';

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
   !['nickname','full_name'].includes(p.display_as)||(p.jersey_number!=null&&(!Number.isInteger(p.jersey_number)||p.jersey_number<0||p.jersey_number>99)))throw new Error('profile_contract_invalid');
  // Pick only the existing contract; never project roles/metadata into the UI.
  return {...(typeof p.email_account==='boolean'?{email_account:p.email_account}:{}),jersey_number:p.jersey_number??null,user_id:userId,login:p.login,phone:p.phone,full_name:p.full_name,display_as:p.display_as,display_name:p.display_name};
 }
 return {
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
  async save(fullName:string,displayAs:'nickname'|'full_name'){
   const problem=fullNameProblem(fullName);if(problem)throw new Error('profile_validation');
   validate(await existing.saveProfile(fullName.trim(),displayAs));
   // Explicit server read-back; do not infer success from the submitted draft.
   const confirmed=validate(await existing.readProfile());
   if(!confirmed||confirmed.full_name!==fullName.trim()||confirmed.display_as!==displayAs)throw new Error('profile_readback_mismatch');
   return confirmed;
  },
 };
}
