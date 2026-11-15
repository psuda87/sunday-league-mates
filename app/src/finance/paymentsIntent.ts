// "Zgłoś wpłatę" in the notification bell opens the own profile with "Moje płatności" expanded.
// The profile may mount after the request (tab switch) or already be mounted (event).
export const ownPaymentsRequestEvent = 'slm-open-own-payments';
// Fired after an own payment report so the bell can recount outstanding matches.
export const financeChangedEvent = 'slm-finance-changed';
let requested = false;
export function requestOwnPayments() {
  requested = true;
  window.dispatchEvent(new Event(ownPaymentsRequestEvent));
}
export function takeOwnPaymentsRequest() {
  const value = requested;
  requested = false;
  return value;
}
