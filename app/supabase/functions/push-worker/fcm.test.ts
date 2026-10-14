import { describe, expect, it } from 'vitest';
import { classify, message } from './fcm';
describe('kontrakt FCM (przygotowany, nieuruchomiony)', () => {
  it('dezaktywuje tylko jawnie niezarejestrowany token; błędny payload nie usuwa tokenu', () => {
    expect(classify(404,{ error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode: 'UNREGISTERED' }] } }).result).toBe('invalid_token');
    expect(classify(400,{ error: { status: 'INVALID_ARGUMENT' } }).result).toBe('dead');
    expect(classify(429,{}).result).toBe('retry'); expect(classify(503,{}).result).toBe('retry');
  });
  it('nie ujawnia danych grupy ani kwot i używa jednego ID do deduplikacji', () => {
    const id = crypto.randomUUID();
    const body = message({ queue_id: crypto.randomUUID(),lease_id: crypto.randomUUID(),notification_id: id,
      event_id: crypto.randomUUID(),kind: 'registration_blocked',platform: 'android',token: 'synthetic-fcm-fixture',
      expires_at: new Date(Date.now()+300000).toISOString() }).message;
    expect(body.data).toEqual({ notification_id: id,kind: 'registration_blocked' });
    expect(body.notification.body).not.toContain('zaleg'); expect(body.android.notification.tag).toBe(id);
    expect(body.apns.headers['apns-collapse-id']).toBe(id);
    expect(Number(body.android.ttl.replace('s',''))).toBeLessThanOrEqual(300);
  });
});
