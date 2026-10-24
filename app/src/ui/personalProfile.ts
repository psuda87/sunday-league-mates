// Presentation contract only. No Auth, API, tokens, persistence or demo world mutation.
export interface PersonalProfileData {
 user_id:string;login:string;phone:string;full_name:string;
 display_as:'nickname'|'full_name';display_name:string;
}
export interface PersonalProfileBinding {
 phase:'loading'|'ready'|'missing'|'error';profile:PersonalProfileData|null;
 saving:boolean;notice:string;reload:()=>void;save:(fullName:string)=>Promise<boolean>;
}
