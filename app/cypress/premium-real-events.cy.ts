// Full real local UI → Edge → Auth/PostgREST; no intercepted fixture responses.
let fixture:Record<string,string>;
before(()=>cy.env(['a_name','b_name','group_id','event_id','tag'],{log:false}).then(values=>{fixture=values as Record<string,string>;}));
function login(who:'a'|'b'){
 cy.visit('/');cy.contains('h1','Zaloguj się').should('be.visible');
 cy.env([who+'_email',who+'_password'],{log:false}).then(values=>{
  cy.get('input[autocomplete="username"]').type(String(values[who+'_email']),{log:false});
  cy.get('input[type="password"]').type(String(values[who+'_password']),{log:false});cy.get('form').submit();
 });
 cy.get('select[aria-label="Aktywna grupa"]',{timeout:20000}).should('be.visible').select(fixture['group_id']);
 cy.get('.slm-demo-tools').should('not.exist');cy.get('.slm-demo-badge').should('not.exist');
}
describe('Premium real groups/events/registrations',()=>{
 it('first user creates a real match in original Premium form and keeps mobile layout',()=>{
  login('a');cy.contains('ion-button','Utwórz mecz').click();
  cy.get('#event-name').type('UI created '+fixture['tag']);cy.get('#event-date').clear().type('01.01.2099');
  cy.get('#event-time').clear().type('18:00');cy.get('#event-location').should('have.value','').type('Synthetic browser pitch');cy.get('#event-capacity').type('10');
  cy.contains('button','Podgląd meczu').click();cy.contains('button','Utwórz mecz').click();
  cy.contains('.slm-detail-name','UI created '+fixture['tag'],{timeout:15000}).should('be.visible');
  cy.contains('h3','Uczestnicy').closest('section').should('contain','Brak zapisanych osób');
  for(const width of [320,360,390])for(const dark of [false,true]){
   cy.viewport(width,760);cy.document().then(doc=>{doc.documentElement.classList.toggle('ion-palette-dark',dark);doc.documentElement.dataset.appearance=dark?'dark':'light';});
   cy.get('.slm-match-detail').should('be.visible').then($e=>{expect($e[0].getBoundingClientRect().right).to.be.at.most(width+1);});
  }
  cy.viewport(390,760);cy.document().then(doc=>doc.documentElement.classList.remove('ion-palette-dark'));cy.screenshot('real-empty-light',{capture:'viewport',overwrite:true});
  cy.get('button[data-tab="groups"]').click();cy.contains('button',fixture['tag']).first().click();cy.get('.slm-group-roster').should('contain',fixture['a_name']).and('contain',fixture['b_name']);cy.get('button[data-tab="events"]').click();cy.get('select[aria-label="Aktywna grupa"]').should('be.visible');cy.get('.slm-detail-name').should('not.exist');
 });
 it('second independent user sees same match, signs up and adds two actual guests',()=>{
  login('b');cy.get('[data-event="'+fixture['event_id']+'"] button.slm-card-link').click();
  cy.contains('[data-entry]',fixture['a_name']).should('be.visible');cy.contains('ion-button','ZAPISZ SIĘ NA MECZ').click();
  cy.contains('ion-button','WYCOFAJ ZAPIS',{timeout:15000}).should('be.visible');cy.contains('[data-entry]',fixture['b_name']).should('be.visible');
  for(const name of ['Browser guest one','Browser guest two']){
   cy.contains('summary','Dodaj gościa').click();cy.contains('label','Imię lub pseudonim gościa').find('input').type(name);cy.contains('button','Zapisz gościa').click();
   cy.contains('[data-entry]',name,{timeout:15000}).should('exist');
  }
  cy.get('ion-button[aria-label="Odśwież mecze"]').click();cy.contains('[data-entry]','Browser guest two').should('exist');
  cy.viewport(320,420);cy.contains('summary','Dodaj gościa').click();cy.contains('label','Imię lub pseudonim gościa').find('input').focus();
  cy.get('.slm-matches-screen').then($e=>expect($e[0].scrollWidth).to.be.at.most(320));
  cy.contains('summary','Dodaj gościa').click();cy.viewport(360,760);cy.document().then(doc=>doc.documentElement.classList.add('ion-palette-dark'));
  cy.screenshot('real-participants-dark',{capture:'viewport',overwrite:true});
  cy.get('button[data-tab="profile"]').click();cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('button','Wyloguj').click();cy.contains('h1','Zaloguj się').should('be.visible');
 });
});
