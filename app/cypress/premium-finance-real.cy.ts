// Real Chrome → local64321 Auth/Edge/PostgREST. No fixture response bodies.
let fixture:Record<string,string>;
before(()=>cy.env(['player_name','player_id','group_id','other_group_id','event_id','tag'],{log:false}).then(v=>{fixture=v as Record<string,string>;}));
function login(who:'admin'|'player'){
 cy.visit('/');cy.contains('h1','Zaloguj się').should('be.visible');
 cy.env([who+'_email',who+'_password'],{log:false}).then(v=>{
  cy.get('input[autocomplete="username"]').type(String(v[who+'_email']),{log:false});cy.get('input[type="password"]').type(String(v[who+'_password']),{log:false});cy.get('form').submit();
 });
 cy.get('select[aria-label="Aktywna grupa"]',{timeout:20000}).should('be.visible');
}
function openFinance(){
 cy.contains('button','Historia').click();cy.get('[data-event="'+fixture.event_id+'"] button.slm-card-link').click();cy.contains('[role="tab"]','Rozliczenie').click();cy.get('.slm-premium-finance .slm-finance-tiles',{timeout:15000}).should('be.visible');
}
function logout(){cy.get('button[data-tab="profile"]').click();cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('button','Wyloguj').click();cy.contains('h1','Zaloguj się').should('be.visible');cy.get('.slm-premium-finance').should('not.exist');}
function reason(text:string){cy.get('.slm-finance-form textarea').clear().type(text);}
describe('Finance Stage2 real Supabase',()=>{
 it('group administrator approves a finished match with real guest shares',()=>{
  login('admin');openFinance();reason('Synthetic browser finished approval');cy.contains('button','Zatwierdź zakończony mecz').click();
  cy.contains('.slm-panel','Administracja rozliczeniem meczu').should('contain','Zatwierdzone').and('contain','34,00');
  cy.get('[role="tab"][aria-selected="true"]').should('contain','Rozliczenie');logout();
 });
 it('player sees actual debt and retries a lost write acknowledgement without duplicate receipt',()=>{
  login('player');openFinance();cy.contains('.slm-finance-tiles','102,00').should('be.visible');cy.contains('button','Potwierdź otrzymaną wpłatę').should('not.exist');
  for(const width of [320,360,390])for(const dark of [false,true]){
   cy.viewport(width,760);cy.document().then(doc=>doc.documentElement.classList.toggle('ion-palette-dark',dark));
   cy.get('.slm-premium-finance').then($e=>expect($e[0].getBoundingClientRect().right).to.be.at.most(width+1));
  }
  cy.viewport(360,760);cy.document().then(doc=>doc.documentElement.classList.add('ion-palette-dark'));cy.get('.slm-finance-tiles').scrollIntoView();cy.screenshot('user-real-debt-dark',{capture:'viewport',overwrite:true});
  const ids:string[]=[];let lose=true;
  cy.intercept('POST','**/functions/v1/accounts',req=>{if(req.body?.action==='group_finance_submit_payment'){ids.push(req.body.request_id);if(lose){lose=false;req.continue(res=>{res.setDelay(25000);});}}});
  cy.viewport(320,420);cy.get('.slm-finance-form input').focus().type('40,00');reason('Synthetic browser transport retry');
  cy.get('.slm-premium-finance').then($e=>expect($e[0].scrollWidth).to.be.at.most(320));cy.contains('button','Zgłoś do zatwierdzenia').click();
  // The existing SessionManager intentionally hides ALL private screens offline.
  cy.contains('h1','Brak połączenia',{timeout:26000}).should('be.visible');cy.get('.slm-premium-finance').should('not.exist');
  cy.contains('button','Spróbuj ponownie').click();cy.get('select[aria-label="Aktywna grupa"]',{timeout:20000}).should('be.visible');openFinance();
  cy.get('.slm-finance-tiles').should('contain','102,00');cy.get('.slm-finance-form input').type('40,00');reason('Synthetic browser transport retry');
  cy.contains('button','Zgłoś do zatwierdzenia').click();cy.contains('[role="status"]','Operacja potwierdzona',{timeout:15000}).should('be.visible');
  cy.then(()=>{expect(ids).to.have.length(2);expect(ids[0]).to.equal(ids[1]);});
  cy.get('.slm-finance-form input').should('have.value','').type('62,00');reason('Synthetic browser final receipt');cy.contains('button','Zgłoś do zatwierdzenia').click();cy.contains('[role="status"]','Operacja potwierdzona').should('be.visible');
  cy.get('.slm-finance-tiles').should('contain','102,00');cy.viewport(390,760);logout();
 });
 it('admin accepts both receipts, player reads paid balance, group switch/network retry has no stale data',()=>{
  login('admin');openFinance();reason('Synthetic browser receipt approval');
  cy.contains('.slm-panel article',/40,00/).within(()=>cy.contains('button','Zatwierdź wpłatę').click());
  cy.contains('[role="status"]','Operacja potwierdzona').should('be.visible');
  cy.contains('.slm-panel article',/62,00/).within(()=>cy.contains('button','Zatwierdź wpłatę').click());
  cy.contains('[role="status"]','Operacja potwierdzona').should('be.visible');cy.get('select[aria-label="Płatnik"]').select(fixture.player_id);cy.get('[data-testid="payer-due"]').should('contain','Opłacono');logout();
  login('player');openFinance();cy.get('.slm-finance-rows').should('contain','Opłacono');cy.get('.slm-finance-tiles dd').first().should('contain','0,00');
  cy.document().then(doc=>doc.documentElement.classList.remove('ion-palette-dark'));cy.viewport(390,760);cy.get('.slm-finance-tiles').scrollIntoView();cy.screenshot('user-real-paid-light',{capture:'viewport',overwrite:true});
  cy.get('button[data-tab="events"]').click();cy.contains('ion-button','Moje rozliczenia grupowe').click();
  cy.contains('label','Grupa rozliczeń').find('select').select(fixture.group_id);cy.contains('.slm-premium-finance','Moje wpłaty').should('be.visible');
  let fail=true;cy.intercept('POST','**/functions/v1/accounts',req=>{if(fail&&req.body?.action==='group_finance_account'&&req.body.group_id===fixture.other_group_id){fail=false;req.destroy();}});
  cy.contains('label','Grupa rozliczeń').find('select').select(fixture.other_group_id);
  cy.contains('h1','Brak połączenia').should('be.visible');cy.get('.slm-finance-tiles').should('not.exist');
  cy.contains('button','Spróbuj ponownie').click();cy.get('select[aria-label="Aktywna grupa"]',{timeout:20000}).should('be.visible');cy.contains('ion-button','Moje rozliczenia grupowe').click();
  cy.contains('label','Grupa rozliczeń').find('select').select(fixture.other_group_id);cy.contains('.slm-premium-finance','Brak wpłat.').should('be.visible');cy.get('.slm-finance-tiles dd').first().should('contain','0,00');logout();
 });
});
