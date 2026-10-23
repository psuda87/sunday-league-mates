// Same fixture, time, theme and viewport against the exact 3.18 baseline and APK assets.
function shot(name:string){cy.wait(100);cy.screenshot(name,{capture:'viewport'});}
function scrollTo(selector:string){cy.get(selector).first().then(target=>{
 cy.get('ion-content').filter(':visible').first().then(async elements=>{const scroll=await (elements[0] as unknown as {getScrollElement:()=>Promise<HTMLElement>}).getScrollElement();scroll.scrollTop+=target[0].getBoundingClientRect().top-scroll.getBoundingClientRect().top;});
});}
describe('Frozen Premium 3.18 — identical rendering and original interactions',()=>{
 for(const width of [320,360,390,430])for(const theme of ['light','dark'])it(`${width}-${theme}`,()=>{
  cy.viewport(width,844);cy.clock(Date.parse('2026-10-19T10:00:00Z'),['Date']);
  cy.intercept('**/functions/v1/**',()=>{throw Error('Stage A must not call Supabase');});
  cy.visit('/',{onBeforeLoad:win=>{win.localStorage.setItem('slm.appearance',theme);win.localStorage.setItem('slm.palette','espana');}});
  cy.get('.slm-demo-nav').should('be.visible');shot(`home-${width}-${theme}`);
  cy.get('.slm-card-link').first().click();cy.get('[role=tab][aria-selected=true]').should('contain','Uczestnicy');
  shot(`details-${width}-${theme}`);
  scrollTo('.slm-roster-overview');shot(`roster-${width}-${theme}`);
  cy.contains('[role=tab]','Składy').click();cy.get('.slm-football-pitch').should('exist');scrollTo('.slm-football-pitch');
  shot(`pitch-${width}-${theme}`);
  cy.get('.slm-football-pitch button').first().click();cy.get('.slm-ultimate-card').should('be.visible');shot(`player-${width}-${theme}`);
  cy.contains('nav[aria-label="Główna nawigacja"] button','Grupy').click();cy.contains('h1','Moje grupy').should('exist');shot(`groups-${width}-${theme}`);
  cy.contains('nav[aria-label="Główna nawigacja"] button','Profil').click();cy.contains('h1','Mój profil').should('exist');shot(`profile-${width}-${theme}`);
  cy.get('.slm-demo-create').click();cy.get('.slm-event-form').should('be.visible');shot(`form-${width}-${theme}`);
  cy.visit('/#account/login');cy.contains('h1','Zaloguj się').should('be.visible');shot(`login-${width}-${theme}`);
  cy.visit('/#account/register');cy.get('.slm-account-shell').should('be.visible');shot(`register-${width}-${theme}`);
  cy.visit('/#account/forgot');cy.get('.slm-account-shell').should('be.visible');shot(`forgot-${width}-${theme}`);
  cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(width));
 });
});
