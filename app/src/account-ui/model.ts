// UI ports only. These are NOT new server endpoints or a Supabase schema.
export type AccountView='login'|'register'|'verify'|'confirmed'|'forgot'|'reset'|'password'|'password-saved'|'first-profile'|'checking'|'expired'|'network'|'signing-out'|'invalid-link';
export interface ProfileDraft { nickname:string; fullName:string; phone:string; jerseyNumber?:number; portrait?:{src:string;column?:0|1;row?:0|1} }
export type AccountCommand='signIn'|'signUp'|'signOut'|'resendVerification'|'requestPasswordReset'|'updatePassword'|'restoreSession'|'completeRedirect'|'saveProfile';
export interface AccountUiPort {
 signIn:(email:string,password:string)=>Promise<void>;
 signUp:(profile:ProfileDraft,email:string,password:string)=>Promise<void>;
 signOut:()=>Promise<void>;
 resendVerification:()=>Promise<void>;
 requestPasswordReset:(email:string)=>Promise<void>;
 updatePassword:(password:string,currentPassword?:string)=>Promise<void>;
 restoreSession:()=>Promise<void>;
 completeRedirect:(intent:'verify'|'recovery')=>Promise<void>;
 saveProfile:(profile:ProfileDraft)=>Promise<void>;
}
export const emptyProfile=():ProfileDraft=>({nickname:'',fullName:'',phone:''});
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
export const emailProblem=(email:string)=>!email.trim()?'Podaj adres e-mail.':email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Wpisz poprawny adres e-mail.':'';
export const passwordProblem=(password:string)=>Array.from(password).length<8||new TextEncoder().encode(password).length>72?'Hasło: minimum 8 znaków, maksimum 72 bajty UTF-8.':'';
export function profileProblems(profile:ProfileDraft):string[] {
 const errors:string[]=[],clean=(value:string,max:number)=>value.trim().length<=max&&!Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127||char==='<'||char==='>');
 if(!profile.nickname.trim()||!clean(profile.nickname,48))errors.push('Podaj nazwę zawodnika od 1 do 48 znaków bez znaków sterujących i nawiasów ostrych.');
 if(!clean(profile.fullName,100))errors.push('Imię i nazwisko: maksymalnie 100 znaków bez znaków sterujących.');
 if(profile.phone.trim()&&!/^(?:(?:\+48|0048)?[\s()-]*)?(?:\d[\s()-]*){9}$/.test(profile.phone.trim()))errors.push('Telefon opcjonalny: 9 cyfr, ewentualnie +48 lub 0048.');
 if(profile.jerseyNumber!==undefined&&(!Number.isInteger(profile.jerseyNumber)||profile.jerseyNumber<0||profile.jerseyNumber>99))errors.push('Numer koszulki: liczba całkowita 0–99 albo puste pole.');
 return errors;
}
export function accountRoute(hash:string):AccountView|null {
 const exact:Record<string,AccountView>={'#account/login':'login','#account/register':'register','#account/verify':'invalid-link','#account/recovery':'invalid-link','#account/forgot':'forgot'};
 return exact[hash]??(hash.startsWith('#account/')?'invalid-link':null);
}
export class AccountUiFailure extends Error {constructor(readonly kind:'network'|'credentials'|'link'|'integration'){super(kind);}}
export function accountMessage(error:unknown) {
 if(error instanceof AccountUiFailure){if(error.kind==='network')return 'Brak połączenia. Sprawdź internet i spróbuj ponownie.';if(error.kind==='credentials')return 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.';if(error.kind==='link')return 'Link jest nieprawidłowy lub wygasł. Poproś o nowy.';if(error.kind==='integration')return 'Ta operacja wymaga podłączenia właściwego Auth. Nie wykonano zmiany.';}
 return 'Nie udało się wykonać operacji. Spróbuj ponownie później.';
}

export const nicknameProblem=(value:string)=>/^[\p{L}][\p{L}\p{N}_.-]{2,31}$/u.test(value.trim().normalize('NFC'))?'':'Pseudonim: 3–32 znaki, pierwsza litera, dalej litery, cyfry, _, . lub -.';
