describe('Fikcyjny mecz 6 na 6', () => {
  it('shows every name, swaps a guest with a member, resets and reloads without backend traffic', () => {
    const backend: string[] = [];
    cy.intercept({url: /supabase\.co|\/functions\/v1\/|\/auth\/v1\//}, request => {
      backend.push(request.url);
      request.destroy();
    });
    cy.viewport(390, 844);
    cy.visit('/');
    cy.contains('Fikcyjny mecz testowy').should('be.visible');
    const a = '[aria-label="Drużyna A, 6 osób"]', b = '[aria-label="Drużyna B, 6 osób"]';
    cy.get(a).find('[data-entry]').should('have.length', 6);
    cy.get(b).find('[data-entry]').should('have.length', 6);
    ['suda', 'adam p.', 'sebastian s.', 'ariel', 'marek', 'michał', 'tomek B', 'Mateusz', 'dawid', 'kuba', 'krystian', 'kolega krystiana'].forEach(name => {
      cy.get('[aria-label="Uczestnicy meczu testowego"] .slm-demo-person-meta').contains(name).should('exist');
    });
    cy.contains('button', 'Zamień zawodników').click();
    cy.get(a).find('button[aria-label="Wybierz do zamiany: suda"]').click();
    cy.get(b).find('button[aria-label="Wybierz do zamiany: kolega krystiana"]').click();
    cy.get(a).find('button[aria-label="Wybierz do zamiany: kolega krystiana"]').should('exist');
    cy.get(b).find('button[aria-label="Wybierz do zamiany: suda"]').should('exist');
    cy.contains('button', 'Reset podziału').click();
    cy.get(a).find('button[aria-label="Wybierz do zamiany: suda"]').should('exist');
    cy.get(a).find('button[aria-label="Wybierz do zamiany: suda"]').click();
    cy.get(b).find('button[aria-label="Wybierz do zamiany: kolega krystiana"]').click();
    cy.reload();
    cy.get(a).find('[aria-label="Otwórz kartę: suda"]').should('exist');
    cy.get(b).find('[data-entry="demo-six-entry-12"]').should('exist');
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(390));
    cy.then(() => expect(backend).to.deep.equal([]));
  });
});
