import { useId, useState } from 'react';
import { IonIcon, IonInput } from '@ionic/react';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';
import './account.css';
export function AccountHeading({title,children}:{title:string;children?:ReactNode}) {return <><h1>{title}</h1>{children&&<p className="slm-muted">{children}</p>}</>;}
export function TextField({label,value,onChange,type='text',autoComplete,maxLength,inputMode,id}:{label:string;value:string;onChange:(value:string)=>void;type?:string;autoComplete?:string;maxLength?:number;inputMode?:'numeric'|'email'|'tel';id?:string}) {
 const generated=useId();return <label className="slm-account-field" htmlFor={id??generated}><span>{label}</span><input id={id??generated} value={value} type={type} autoComplete={autoComplete} maxLength={maxLength} inputMode={inputMode} onChange={e=>onChange(e.target.value)}/></label>;
}
export function PasswordField({label,value,onChange,newPassword=false,ionic=false}:{label:string;value:string;onChange:(value:string)=>void;newPassword?:boolean;ionic?:boolean}) {
 const [shown,setShown]=useState(false),id=useId();
 return <div className="slm-password-field">{ionic?<IonInput label={label} labelPlacement="stacked" type={shown?'text':'password'} autocomplete={newPassword?'new-password':'current-password'} required minlength={newPassword?8:undefined} value={value} onIonInput={e=>onChange(e.detail.value??'')}/>:<label className="slm-account-field" htmlFor={id}><span>{label}</span><input id={id} type={shown?'text':'password'} autoComplete={newPassword?'new-password':'current-password'} value={value} onChange={e=>onChange(e.target.value)}/></label>}<button className="slm-password-eye" type="button" aria-label={`${shown?'Ukryj':'Pokaż'} hasło: ${label}`} aria-pressed={shown} onClick={()=>setShown(!shown)}><IonIcon icon={shown?eyeOffOutline:eyeOutline} aria-hidden="true"/></button></div>;
}
export function SignInFields({identifier,password,onIdentifier,onPassword,legacy=false}:{identifier:string;password:string;onIdentifier:(value:string)=>void;onPassword:(value:string)=>void;legacy?:boolean}) {
 return <>{legacy?<IonInput label="Login lub numer telefonu" labelPlacement="stacked" autocomplete="username" required value={identifier} onIonInput={e=>onIdentifier(e.detail.value??'')}/>:<TextField id="account-email" label="Adres e-mail" value={identifier} onChange={onIdentifier} type="email" autoComplete="username" inputMode="email" maxLength={254}/>}<PasswordField label="Hasło" value={password} onChange={onPassword} ionic={legacy}/></>;
}
