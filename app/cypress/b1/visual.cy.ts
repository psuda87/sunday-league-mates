describe('B1 live composition visual evidence (controlled session, demo world)',()=>{
 for(const width of [320,360,390,430])for(const theme of ['light','dark'])it(`${width}-${theme}`,()=>{
  cy.viewport(width,844);cy.clock(Date.parse('2026-10-19T10:00:00Z'),['Date']);
  cy.intercept('POST','**/functions/v1/accounts',{access_token:'visual-test',refresh_token:'visual-refresh',expires_in:3600,user_id:'fictional-visual-test',role:'member',must_change_password:false});
  cy.visit('/',{onBeforeLoad:win=>{win.localStorage.clear();win.localStorage.setItem('slm.appearance',theme);win.localStorage.setItem('slm.palette','espana');}});
  cy.contains('h1','Zaloguj się').should('be.visible');cy.wait(100);cy.screenshot(`login-${width}-${theme}`,{capture:'viewport'});
  cy.get('#account-email').type('Fikcyjny');cy.get('input[autocomplete="current-password"]').type('Visual-test-secret',{log:false});cy.contains('button','Zaloguj').click();
  cy.get('.slm-demo-nav').should('be.visible');cy.wait(100);cy.screenshot(`home-${width}-${theme}`,{capture:'viewport'});
  cy.contains('nav button','Profil').click();cy.wait(100);cy.screenshot(`profile-${width}-${theme}`,{capture:'viewport'});
 });
});
