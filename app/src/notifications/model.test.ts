import { describe, expect, it } from 'vitest';
import { notificationId } from './model';
import { financeSourceKey } from './financeAdapter';
describe('granice powiadomień', () => {
  it('nie przyjmuje URL ani identyfikatora meczu jako celu z FCM', () => {
    const id = crypto.randomUUID();
    expect(notificationId({ event_id: id,url: 'https://example.invalid' })).toBeNull();
    expect(notificationId({ notification_id: id })).toBe(id);
    expect(notificationId({ notification_id: 'javascript:alert(1)' })).toBeNull();
  });
  it('finansowy adapter identyfikuje decyzję/przejście, a nie tworzy zdarzeń', () => {
    expect(financeSourceKey({ kind: 'payment_accepted',paymentId: 'payment-fixture',decisionId: 'decision-fixture',userId: 'user-fixture' }))
      .toBe('finance:payment:payment-fixture:decision-fixture');
    expect(financeSourceKey({ kind: 'registration_unblocked',transitionId: 'transition-fixture',userId: 'user-fixture' }))
      .toBe('finance:block:user-fixture:transition-fixture');
  });
});
