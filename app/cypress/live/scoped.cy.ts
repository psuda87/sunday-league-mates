import { accountAction } from '../support/navigation';
// No mocked responses. Run only via scripts/test-live-ui-local.mjs.
describe('Rzeczywista przeglądarka i lokalny Supabase',()=>{
 it('loguje e-mailem, tworzy grupę i mecz, zapisuje siebie i gościa do rezerwy, otwiera finanse i wylogowuje',()=>{
  cy.intercept('**/functions/v1/accounts',req=>{
   if(!req.url.startsWith('http://127.0.0.1:54321/'))throw new Error('Remote API forbidden in local integration test');
   if(req.body.action==='matches_create')req.alias='createMatch';
   if(req.body.action==='matches_detail')req.alias='matchDetail';
   req.continue(response=>{
    if(req.body.action==='matches_detail'&&response.statusCode===200)expect(response.body.event.id).to.eq(req.body.event_id);
    if(req.body.action==='matches_list'&&response.statusCode===200){const ids=response.body.events.map((event:{id:string})=>event.id);expect(new Set(ids).size).to.eq(ids.length);}
   });
  });
  cy.visit('/');
  cy.env(['slm_email','slm_password'],{log:false}).then(values=>{
   cy.get('ion-input').filter((_,el)=>(el as unknown as {label:string}).label==='E-mail, login lub numer telefonu').find('input').type(String(values.slm_email),{log:false});
   cy.get('input[type="password"]').type(String(values.slm_password),{log:false});
  });
  cy.contains('ion-button','Zaloguj się').click();
  cy.contains('nav[aria-label="Główna nawigacja"] button','Grupy').click();
  cy.contains('section','Utwórz grupę').within(()=>{cy.contains('label','Nazwa').find('input').type('Live fixture group');cy.contains('ion-button','Utwórz grupę').click();});
  cy.contains('h2','Live fixture group').should('be.visible');
  cy.contains('nav.slm-bottom-nav button','Mecze').click();cy.contains('ion-button','Utwórz mecz').click();
  cy.contains('label','Nazwa').find('input').clear().type('Live fixture match');
  cy.get('input[placeholder="DD.MM.RRRR"]').type('19102099');cy.get('input[placeholder="HH:mm"]').type('19:00');
  cy.contains('label','Miejsce').find('input').type('Live fixture pitch');
  cy.contains('label','Limit miejsc').find('input').type('10');
  cy.get('input:invalid').should('have.length',0);
  cy.contains('ion-button','Zapisz mecz').click();
  cy.wait('@createMatch').then(created=>{
   expect(created.response?.statusCode,JSON.stringify(created.response?.body)).to.eq(200);
   expect(created.request.body.name).to.eq('Live fixture match');
   cy.wait('@matchDetail').then(detail=>{
    expect(detail.request.body.event_id).to.eq(created.response?.body.event_id);
    expect(detail.response?.statusCode).to.eq(200);
    expect(detail.response?.body.event.group_id).to.eq(created.request.body.group_id);
    expect(detail.response?.body.event.name).to.eq('Live fixture match');
   });
  });
  cy.get('[role="alert"]').should('not.exist');
  cy.contains('h2','Live fixture match').should('be.visible');
  cy.contains('ion-button','Zapisz się').click();cy.contains('Jesteś zapisany').should('be.visible');
  cy.contains('nav.slm-bottom-nav button','Mecze').click();cy.contains('button','Moje').click();cy.contains('h2','Live fixture match').should('be.visible');cy.get('button[aria-label^="Otwórz szczegóły meczu"]').first().click();
  cy.contains('summary','Dodaj gościa').click();
  cy.get('.slm-guest-form').within(()=>{cy.contains('label','Imię / pseudonim').find('input').type('Live fixture guest');cy.get('input[type="checkbox"]').check();cy.contains('ion-button','Dodaj gościa').click();});
  cy.contains('h3','Rezerwa').closest('section').should('contain','Live fixture guest');
  // Two different matches in the same real group catch an unfiltered match_summary.
  cy.contains('nav.slm-bottom-nav button','Mecze').click();
  cy.get('button[aria-label="Utwórz mecz"]').click();
  cy.contains('label','Nazwa').find('input').clear().type('Second live fixture match');
  cy.get('input[placeholder="DD.MM.RRRR"]').type('20102099');
  cy.get('input[placeholder="HH:mm"]').type('2000');
  cy.contains('label','Miejsce').find('input').type('Second live fixture pitch');
  cy.contains('label','Limit miejsc').find('input').type('10');
  cy.contains('ion-button','Zapisz mecz').click();
  cy.contains('h2','Second live fixture match').should('be.visible');
  cy.contains('nav.slm-bottom-nav button','Mecze').click();
  cy.contains('h2','Live fixture match').should('be.visible');
  cy.contains('h2','Second live fixture match').should('be.visible');
  accountAction('Rozliczenia');cy.contains('h2','Moje saldo w grupie').should('be.visible');
  accountAction('Wyloguj się');cy.contains('h1','Zaloguj się').should('be.visible');
 });
});
