describe('Rzeczywista referencja pobrana z Vercel (Premium 3.13)',()=>{
 for(const theme of ['light','dark'])it(theme,()=>{
  cy.viewport(390,844);cy.visit('/',{onBeforeLoad:win=>win.localStorage.setItem('slm.appearance',theme)});
  cy.get('.slm-card-link').first().click();
  cy.screenshot(`vercel313-participants-${theme}`,{capture:'fullPage'});
  cy.contains('[role=tab]','Składy').click();cy.get('.slm-football-pitch').should('be.visible');
  cy.screenshot(`vercel313-pitch-${theme}`,{capture:'fullPage'});
  cy.get('.slm-football-pitch button').first().click();
  cy.screenshot(`vercel313-player-${theme}`,{capture:'fullPage'});
 });
});
