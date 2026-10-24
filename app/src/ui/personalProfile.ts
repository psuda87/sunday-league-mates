// Presentation contract only. No Auth, API, tokens, persistence or demo world mutation.
export interface PersonalProfileData {
 user_id:string;login:string;phone:string;full_name:string;
 jersey_number?:number|null;
 display_as:'nickname'|'full_name';display_name:string;
}
export interface PersonalProfileBinding {
 phase:'loading'|'ready'|'missing'|'error';profile:PersonalProfileData|null;
 photo?:PersonalPhotoBinding;saveNumber?:(number:number)=>Promise<boolean>;
 saving:boolean;notice:string;reload:()=>void;save:(fullName:string)=>Promise<boolean>;
}

export interface PersonalPhotoBinding {
 phase:'loading'|'ready'|'error';image:string|null;saving:boolean;notice:string;
 beginSelection:()=>void;endSelection:()=>void;
 prepare:(file:File)=>Promise<string>;save:(image:string)=>Promise<boolean>;
 remove:()=>Promise<boolean>;reload:()=>void;
}
