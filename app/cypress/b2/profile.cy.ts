const auth=(id='own')=>({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user_id:id,role:'member',must_change_password:false});
const profile=(id='own',name='Testowy Zawodnik')=>({user_id:id,login:id==='own'?'Fikcyjny':'Drugi',phone:'+48000000999',full_name:name,display_as:'full_name',display_name:name});
function login(name='Fikcyjny'){cy.get('#account-email').type(name);cy.get('input[autocomplete="current-password"]').type('Only-test-secret',{log:false});cy.get('form button[type=submit]').click();cy.get('.slm-demo-nav').should('be.visible');}
function openProfile(){cy.contains('nav button','Profil').click();}
describe('B2.1 original profile presentation and existing accounts contract (controlled responses)',()=>{
 beforeEach(()=>cy.viewport(390,844));
 it('reads, edits only full name, confirms read-back, restores and isolates account switch/demo',()=>{
  let current='own',stored='Testowy Zawodnik';const writes:unknown[]=[];
  cy.intercept('POST','**/functions/v1/accounts',req=>{
   const action=req.body.action;if(action==='login')current=req.body.identifier==='Drugi'?'second':'own';
   if(action==='save_profile'){writes.push(req.body);stored=req.body.full_name;}
   req.reply(action==='profile'||action==='save_profile'?profile(current,current==='own'?stored:'Inne Konto'):action==='logout'?{}:auth(current));
  });
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});login();
  cy.get('.slm-card-link').first().click();cy.get('.slm-players-screen').should('not.exist');
  openProfile();cy.contains('h2','Testowy Zawodnik').should('be.visible');cy.get('.slm-ultimate-portrait').should('have.attr','data-portrait','initials');
  cy.get('.slm-ultimate-stats dd').each(el=>expect(el.text()).eq('—'));cy.contains('button','Zmień zdjęcie').should('be.disabled');
  cy.contains('button','Edytuj profil').click();cy.get('input[readonly]').should('have.value','Fikcyjny');
  cy.screenshot('b2-own-editor',{capture:'viewport'});
  cy.get('.slm-identity-editor input').eq(1).clear().type('Zapisany Zawodnik');cy.contains('button','Zapisz dane').click();
  cy.contains('h2','Zapisany Zawodnik').should('be.visible');cy.contains('Zapisano profil i potwierdzono').should('be.visible');
  cy.then(()=>expect(writes).deep.eq([{action:'save_profile',full_name:'Zapisany Zawodnik',display_as:'full_name'}]));
  cy.reload();cy.get('.slm-demo-nav').should('be.visible');openProfile();cy.contains('h2','Zapisany Zawodnik').should('be.visible');
  cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('Login: Fikcyjny').should('be.visible');cy.contains('Telefon: +48000000999').should('be.visible');cy.screenshot('b2-own-settings',{capture:'viewport'});
  cy.contains('button','Wyloguj').click();cy.contains('h1','Zaloguj się').should('be.visible');cy.contains('Zapisany Zawodnik').should('not.exist');
  login('Drugi');openProfile();cy.contains('h2','Inne Konto').should('be.visible');cy.contains('Zapisany Zawodnik').should('not.exist');
 });
 it('never substitutes demo identity after a failed profile read and permits safe retry',()=>{
  let fail:'missing'|'network'|'expired'|'none'='missing';
  cy.intercept('POST','**/functions/v1/accounts',req=>{
   if(req.body.action==='profile'){if(fail==='missing')req.reply(404,{code:'profile_not_found',error:'private backend detail'});else if(fail==='network')req.destroy();else if(fail==='expired')req.reply(401,{code:'session_invalid'});else req.reply(profile());}
   else req.reply(auth());
  });
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});login();openProfile();
  cy.contains('Nie udało się odczytać profilu').should('exist');cy.contains('private backend detail').should('not.exist');
  cy.get('.slm-ultimate-nameplate').should('contain','—');cy.get('.slm-ultimate-stats dd').each(el=>expect(el.text()).eq('—'));
  cy.then(()=>{fail='none';});cy.contains('button','Ponów odczyt profilu').click();cy.contains('h2','Testowy Zawodnik').should('be.visible');
  cy.then(()=>{fail='network';});cy.reload();cy.contains('h1','Brak połączenia').should('be.visible');cy.contains('h2','Testowy Zawodnik').should('not.exist');
  cy.then(()=>{fail='none';});cy.contains('button','Spróbuj ponownie').click();cy.get('.slm-demo-nav').should('be.visible');openProfile();cy.contains('h2','Testowy Zawodnik').should('be.visible');
  cy.then(()=>{fail='expired';});cy.reload();cy.contains('h1','Sesja wygasła').should('be.visible');cy.contains('h2','Testowy Zawodnik').should('not.exist');
 });
});
