// No mocked responses. Run only via scripts/test-live-ui-local.mjs.
describe('Rzeczywista przeglądarka i lokalny Supabase',()=>{
 it('loguje e-mailem, tworzy grupę i mecz, zapisuje siebie i gościa do rezerwy, otwiera finanse i wylogowuje',()=>{
  cy.intercept('**/functions/v1/accounts',req=>{if(!req.url.startsWith('http://127.0.0.1:54321/'))throw new Error('Remote API forbidden in local integration test');if(req.body?.action==='login')req.alias='liveLogin';req.continue();});
  cy.visit('/');
  cy.env(['slm_email','slm_password'],{log:false}).then(values=>{
   cy.get('ion-input').filter((_,el)=>(el as unknown as {label:string}).label==='E-mail, login lub numer telefonu').find('input').type(String(values.slm_email),{log:false});
   cy.get('input[type="password"]').type(String(values.slm_password),{log:false});
  });
  cy.contains('ion-button','Zaloguj się').click();
  cy.wait('@liveLogin').its('response.statusCode').should('eq',200);
  cy.get('[role=alert]').should('not.exist');
  cy.contains('nav[aria-label="Główna nawigacja"] button','Grupy').click();
  cy.contains('section','Utwórz grupę').within(()=>{cy.contains('label','Nazwa').find('input').type('Live fixture group');cy.contains('ion-button','Utwórz grupę').click();});
  cy.contains('h2','Live fixture group').should('be.visible');
  cy.contains('ion-button','Mecze').click();cy.contains('ion-button','Utwórz mecz').click();
  cy.contains('label','Nazwa').find('input').clear().type('Live fixture match');
  cy.get('input[type="date"]').type('2099-10-19');cy.get('input[type="time"]').type('19:00');
  cy.contains('label','Miejsce').find('input').type('Live fixture pitch');
  cy.contains('label','Limit miejsc').find('input').type('10');
  cy.contains('ion-button','Zapisz mecz').click();
  cy.contains('h2','Live fixture match').should('be.visible');
  cy.contains('ion-button','Zapisz się').click();cy.contains('Jesteś zapisany').should('be.visible');
  cy.contains('ion-button','Mecze').click();cy.contains('button','Moje').click();cy.contains('h2','Live fixture match').should('be.visible');cy.get('button[aria-label^="Otwórz szczegóły meczu"]').first().click();
  cy.contains('section','Dodaj gościa').within(()=>{cy.contains('label','Imię / pseudonim').find('input').type('Live fixture guest');cy.get('input[type="checkbox"]').check();cy.contains('ion-button','Dodaj gościa').click();});
  cy.contains('h3','Rezerwa').closest('section').should('contain','Live fixture guest');
  cy.contains('ion-button','Rozliczenia').first().click();cy.contains('h2','Moje saldo w grupie').should('be.visible');
  cy.contains('ion-button','Wyloguj się').click();cy.contains('h1','Zaloguj się').should('be.visible');
 });
});
