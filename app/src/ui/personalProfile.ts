// Presentation contract only. No Auth, API, tokens, persistence or demo world mutation.
export interface PersonalProfileData {
 user_id:string;login:string;phone:string;full_name:string;
 nickname?:string;first_name?:string;group_scope?:{group_id:string;share_full_name:boolean;share_first_name:boolean}[];
 email_account?:boolean;
 jersey_number?:number|null;
 display_as:'nickname'|'first_name'|'full_name';display_name:string;
}
export interface PersonalProfileBinding {
 phase:'loading'|'ready'|'missing'|'error';profile:PersonalProfileData|null;
 changeAlias?:(login:string,currentPassword:string)=>Promise<boolean>;
 photo?:PersonalPhotoBinding;saveNumber?:(number:number)=>Promise<boolean>;
 saveIdentity?:(draft:IdentityDraft)=>Promise<boolean>;
 saving:boolean;notice:string;reload:()=>void;save:(fullName:string,number?:number)=>Promise<boolean>;
}

export interface PersonalPhotoBinding {
 phase:'loading'|'ready'|'error';image:string|null;saving:boolean;notice:string;
 beginSelection:()=>void;endSelection:()=>void;
 prepare:(file:File)=>Promise<string>;save:(image:string)=>Promise<boolean>;
 remove:()=>Promise<boolean>;reload:()=>void;
}

export interface IdentityDraft {nickname:string;first_name:string;full_name:string;display_as:PersonalProfileData['display_as'];jersey_number:number|null;group_scope:string[];accept_disclosure:boolean;request_id:string}
