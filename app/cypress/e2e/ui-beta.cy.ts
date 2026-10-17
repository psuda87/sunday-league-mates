describe('España UI isolated demo', () => {
  for (const width of [320, 390, 768]) it(`fits ${width}px and switches themes without API`, () => {
    cy.viewport(width, 844);
    cy.intercept('**/functions/v1/**', () => { throw new Error('Demo must not call backend'); });
    cy.visit(Cypress.env('standaloneDemo') ? '/' : '/ui-demo');
    cy.contains('Dane przykładowe').should('be.visible');
    cy.get('[role=progressbar]').should('have.attr', 'aria-valuenow', '12');
    cy.get('.slm-demo-tools summary').click();
    cy.get('input[value=dark]').check(); cy.get('html').should('have.class', 'ion-palette-dark');
    if (width === 390) cy.screenshot('espana-dark', { capture: 'viewport' });
    cy.get('input[value=light]').check(); cy.get('html').should('not.have.class', 'ion-palette-dark');
    if (width === 390) cy.screenshot('espana-light', { capture: 'viewport' });
    cy.reload(); cy.get('.slm-demo-tools summary').click(); cy.get('input[value=light]').should('be.checked');
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).at.most(width));
    cy.get('nav[aria-label="Główna nawigacja"] button').should('have.length', 3);
    cy.get('.slm-card-link').first().focus().type('{enter}');
    cy.contains('h1', 'Szczegóły meczu').should('exist');
    cy.get('[role=tab][aria-selected=true]').should('contain', 'Uczestnicy');
    cy.contains('[role=tab]', 'Składy').click(); cy.contains('Składy dla tego meczu nie są jeszcze dostępne.').should('be.visible');
    cy.contains('ion-button', 'Wróć do meczów').click(); cy.contains('h1', 'Następny mecz').should('be.visible');
  });
});
