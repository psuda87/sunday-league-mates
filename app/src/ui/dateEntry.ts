// Locale-independent presentation; server still validates the Warsaw instant.
export const displayDate = (iso: string) => iso.split('-').reverse().join('.');
export function dateToIso(value: string): string {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) throw new Error('Podaj datę w formacie DD.MM.RRRR.');
  const [day, month, year] = value.split('.');
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso)
    throw new Error('Podaj poprawną datę kalendarzową.');
  return iso;
}
export function dateEntry(value: string) {
  if (!/^[\d.,]*$/.test(value)) return value;
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('.');
}
export function timeEntry(value: string) {
  if (!/^[\d:]*$/.test(value)) return value;
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2)].filter(Boolean).join(':');
}
