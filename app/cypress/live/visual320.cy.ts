// No response mocks. Only scripts/test-visual320-local.mjs supplies credentials.
describe('Premium 3.20 — rzeczywiste UI/API/Postgres i zrzuty',()=>{
 for(const theme of ['light','dark'])it(theme,()=>{
  cy.viewport(390,844);
  cy.intercept('**/functions/v1/accounts*',req=>{if(!req.url.startsWith('http://127.0.0.1:54321/'))throw Error('Remote API forbidden');req.continue();});
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.setItem('slm.appearance',theme)});
  cy.env(['slm_email','slm_password'],{log:false}).then(value=>{
   cy.get('ion-input').filter((_,el)=>(el as unknown as {label:string}).label==='E-mail, login lub numer telefonu').find('input').type(String(value.slm_email),{log:false});
   cy.get('input[type=password]').type(String(value.slm_password),{log:false});
  });
  cy.contains('ion-button','Zaloguj się').click();cy.contains('.slm-hero-card','TEST Premium — mecz kontrolny').find('.slm-card-link').click();
  cy.contains('h1','Szczegóły meczu').should('be.visible');
  cy.contains('button','Pokaż wszystkich (6)').click();
  cy.screenshot(`premium320-live-participants-${theme}`,{capture:'viewport'});
  cy.contains('[role=tab]','Składy').click();cy.contains('summary','Ustaw lokalny podział').click();
  cy.get('.slm-local-lineup-editor select').should('have.length',10).each((el,i)=>cy.wrap(el).select(i%2?'b':'a'));
  cy.get('.slm-football-pitch .slm-pitch-player').should('have.length',10);
  cy.get('.slm-football-pitch').then(pitch=>{
   cy.get('ion-content').first().then(async elements=>{const scroll=await (elements[0] as unknown as {getScrollElement:()=>Promise<HTMLElement>}).getScrollElement();scroll.scrollTop+=pitch[0].getBoundingClientRect().top-scroll.getBoundingClientRect().top;});
  });
  cy.wait(150);cy.screenshot(`premium320-live-pitch-${theme}`,{capture:'viewport'});
  cy.get('.slm-football-pitch button').first().click();cy.contains('ion-title','Profil zawodnika').should('be.visible');
  cy.screenshot(`premium320-live-player-${theme}`,{capture:'viewport'});
  cy.contains('ion-button','Zamknij').click();cy.contains('nav.slm-bottom-nav button','Grupy').click();
  cy.screenshot(`premium320-live-groups-${theme}`,{capture:'viewport'});
 });
});
