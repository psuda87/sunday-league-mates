// Kontrakt integracji serwerowej. Nie generuje produkcyjnych zdarzeń w kliencie.
// Przyszły adapter SQL wywołuje slm_notifications_finance_emit w transakcji rozliczeń.
export type FinancialNotification =
  | { kind: 'payment_accepted' | 'payment_rejected'; paymentId: string; decisionId: string; userId: string }
  | { kind: 'registration_blocked' | 'registration_unblocked'; transitionId: string; userId: string };
export function financeSourceKey(event: FinancialNotification): string {
  return 'paymentId' in event ? `finance:payment:${event.paymentId}:${event.decisionId}`
    : `finance:block:${event.userId}:${event.transitionId}`;
}
