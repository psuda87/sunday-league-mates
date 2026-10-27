// Nonvisual opt-in adapters only. Does not alter the main entry or native config.
import {createAccountRequest} from './api';
import {createProjectTokenStore} from './tokenStore';
import {SessionManager} from './sessionManager';
import {createSignupChallenge} from './signupChallenge';
export function onlineClient(config:{enabled:boolean;projectRef:string;apiOrigin:string;authOrigin:string}){
 if(!config.enabled||!/^[a-z]{20}$/.test(config.projectRef))throw Error('Online client not configured');
 for(const origin of [config.apiOrigin,config.authOrigin]){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password||/\.(invalid|test|example)$/.test(u.hostname))throw Error('Exact HTTPS origin required');}
 const request=createAccountRequest(config.apiOrigin+'/accounts');
 return {manager:new SessionManager(createProjectTokenStore(config.projectRef),request),signupChallenge:createSignupChallenge(config.authOrigin+'/signup-challenge.html')};
}
