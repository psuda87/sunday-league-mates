export const openProfile = () => cy.contains('nav[aria-label="Główna nawigacja"] button', 'Profil').click();
export function accountAction(label: string) {
  openProfile();
  cy.contains('summary', 'Ustawienia aplikacji i konta').click();
  return cy.contains('nav[aria-label="Konto"] ion-button', label).click();
}
