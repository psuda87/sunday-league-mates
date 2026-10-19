import { describe, expect, it } from 'vitest';
import { isPhoneIdentifier, nationalPhone, normalizeLoginPhone, normalizePolishPhone, normalizePhoneUpdate, PHONE_ERROR } from '../../supabase/functions/_shared/phone';
describe('Polska — normalizacja bez zmiany istniejących kont', () => {
  it.each(['000000111', '+48000000111', '0048000000111', '000 000 111', '+48 000 000 111', '0048 000 000 111', '(000) 000-111'])('normalizuje format %s', value => {
    expect(normalizePolishPhone(value)).toBe('+48000000111');
  });
  it.each(['', '00000011', '0000001111', '+4800000011', '+480000001111', '00480000001111', '48000000111', '+12025550111', '000xxx111', '000.000.111'])('odrzuca niepoprawny format %s', value => {
    expect(() => normalizePolishPhone(value)).toThrow(PHONE_ERROR);
  });
  it('jest idempotentna i zachowuje błędny wpis zamiast obcinać cyfry', () => {
    const canonical = normalizePolishPhone('000000111');
    expect(normalizePolishPhone(canonical)).toBe(canonical);
    expect(nationalPhone(canonical)).toBe('000000111');
    expect(nationalPhone('0000001111')).toBe('0000001111');
  });
  it('rozróżnia login i telefon oraz zachowuje historyczne E.164 przy logowaniu', () => {
    expect(isPhoneIdentifier('nick_27')).toBe(false);
    expect(isPhoneIdentifier('000 000 111')).toBe(true);
    expect(isPhoneIdentifier('0048 000 000 111')).toBe(true);
    expect(normalizeLoginPhone('+1 (202) 555-0111')).toBe('+12025550111');
    expect(normalizeLoginPhone('000000111')).toBe('+48000000111');
  });
  it('zachowuje stary zagraniczny numer tylko jeśli nie jest zmieniany', () => {
    expect(normalizePhoneUpdate('+1 (202) 555-0111', '+12025550111')).toBe('+12025550111');
    expect(() => normalizePhoneUpdate('+12025550112', '+12025550111')).toThrow();
  });
});
