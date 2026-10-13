describe('Ekran startowy', () => {
  it('Wyświetla polski komunikat powitalny', () => {
    cy.visit('/')
    cy.contains('#container', 'Witaj w Sunday League Mates!')
  })
})
