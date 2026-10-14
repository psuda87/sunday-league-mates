// Czysty wspólny kod klienta, Edge i lokalnych narzędzi; bez sekretów i SDK Auth.
export const PHONE_ERROR = 'Podaj polski numer: dokładnie 9 cyfr, opcjonalnie z +48 lub 0048.';
const compact = (value: string) => value.trim().replace(/[\s()-]/g, '');
export function normalizePolishPhone(value: string): string {
  let digits = compact(value);
  if (digits.startsWith('+48')) digits = digits.slice(3);
  else if (digits.startsWith('0048')) digits = digits.slice(4);
  if (!/^[0-9]{9}$/.test(digits)) throw new Error(PHONE_ERROR);
  return '+48' + digits;
}
export function nationalPhone(value: string): string {
  try { return normalizePolishPhone(value).slice(3); } catch { return value; }
}
// Tylko logowanie: zachowuje odczyt istniejących zagranicznych aliasów E.164.
// Nowe numery przechodzą normalizePolishPhone; istniejący E.164 można zachować bez zmiany.
export function normalizeLoginPhone(value: string): string {
  const result = compact(value);
  if (!result.startsWith('+48') && /^\+[1-9][0-9]{7,14}$/.test(result)) return result;
  return normalizePolishPhone(value);
}
export const isPhoneIdentifier = (value: string) => /^[+0-9]/.test(value.trim());

// Pozwala zachować istniejący E.164, nie pozwala tworzyć nowego zagranicznego aliasu.
export function normalizePhoneUpdate(value: string, existing?: string): string {
  if (existing && compact(value) === existing && /^\+[1-9][0-9]{7,14}$/.test(existing)) return existing;
  return normalizePolishPhone(value);
}
