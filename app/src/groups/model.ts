import type { GroupAction } from '../demo/groups';
export interface GroupIdentity {id:string;name:string;description:string;admin_id:string}
export interface GroupSummary extends GroupIdentity {organizer:boolean;member_count:number;pending_count:number}
export interface GroupMember {user_id:string;nickname:string;display_name?:string;display_as?:'nickname'|'first_name'|'full_name';first_name?:string|null;share_first_name?:boolean;full_name:string|null;contact_phone:string|null;jersey_number:number|null;organizer:boolean;joined_at:string;share_full_name:boolean}
export interface GroupRequest {id:string;group_id:string;group_name?:string;kind:'invite'|'proposal'|'join';state:'pending'|'accepted'|'rejected'|'cancelled';actor_id?:string;target_id?:string|null;actor_name?:string;target_name?:string;contact_phone?:string|null}
export interface GroupDetail {group:GroupIdentity;members:GroupMember[];requests:GroupRequest[]}
// Presentation-only port. Demo remains independent of SessionManager/API imports.
export interface GroupBinding {
 loading:boolean;busy:boolean;error:string;searching:boolean;finding:boolean;counts:Record<string,number>;pending:Record<string,number>;
 found:{id:string;name:string;description:string;count:number}[];candidates:{id:string;name:string;nick?:string}[];
 requestPhones:Record<string,string>;shareFullName:boolean;shareFirstName?:boolean;displayAs?:'nickname'|'first_name'|'full_name';
 refresh:()=>Promise<void>;open:(id:string)=>Promise<void>;search:(query:string)=>void;findPlayers:(id:string,query:string)=>void;
 create:(name:string,description:string,key:string)=>Promise<string|null>;act:(action:GroupAction)=>void;consent:(share:boolean,confirmNickname?:boolean)=>void;
}
