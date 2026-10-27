describe('prepared static auth hosting, inactive example',()=>{
 it('callback uses exact security headers and strips fragment even while disabled',()=>{
  cy.request('/email-callback.html').then(r=>{expect(r.headers['referrer-policy']).to.eq('no-referrer');expect(r.headers['cache-control']).to.eq('no-store');expect(r.headers['content-security-policy']).to.contain("frame-ancestors 'none'");expect(r.headers['x-frame-options']).to.eq('DENY');});
  cy.visit('/email-callback.html#kind=verify&id=11111111-1111-4111-8111-111111111111&token='+('0'.repeat(64)),{log:false});cy.location('hash').should('eq','');cy.contains('Link jest nieprawidłowy').should('be.visible');cy.contains('button','Potwierdź adres').should('not.exist');
 });
 it('unconfigured challenge loads no provider and stays unavailable',()=>{cy.intercept('https://challenges.cloudflare.com/**',()=>{throw Error('Inactive example must never contact provider');});cy.visit('/signup-challenge.html');cy.contains('Potwierdzanie nie jest skonfigurowane').should('be.visible');cy.request('/signup-challenge.html').then(r=>{expect(r.headers['content-security-policy']).to.contain('frame-ancestors https://app.example.invalid');});});
});
