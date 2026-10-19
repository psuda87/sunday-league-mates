import { IonInput } from '@ionic/react';
import { nationalPhone, PHONE_ERROR } from '../../supabase/functions/_shared/phone';
interface Props { label: string; value: string; onChange: (value: string) => void; required?: boolean }
export default function PhoneInput({ label, value, onChange, required = true }: Props) {
  const foreign = value.startsWith('+') && !value.startsWith('+48');
  return <div className="slm-phone-field">
    <span className="slm-phone-prefix" aria-label={foreign ? 'Dotychczasowy numer zagraniczny' : 'Polska, prefiks +48'}>{foreign ? 'Numer' : '+48'}</span>
    <IonInput label={label} labelPlacement="stacked" type="tel" inputmode="tel" autocomplete="tel-national"
      placeholder="9 cyfr" required={required} value={nationalPhone(value)}
      onIonInput={e => onChange(nationalPhone(e.detail.value ?? ''))} />
    <small className="slm-muted">{foreign ? 'Dotychczasowy numer pozostaje zapisany. Nowy numer podaj jako 9 cyfr (Polska).' : PHONE_ERROR}</small>
  </div>;
}
