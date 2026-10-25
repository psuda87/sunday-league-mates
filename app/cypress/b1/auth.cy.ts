const session=(temporary=false)=>({access_token:'browser-test-access',refresh_token:'browser-test-refresh',expires_in:3600,user_id:'fictional-browser-test',role:'member',must_change_password:temporary});
const ownProfile=()=>({user_id:'fictional-browser-test',login:'Fikcyjny',phone:'',full_name:'Testowy Zawodnik',display_as:'full_name',display_name:'Testowy Zawodnik'});
function login(){cy.get('#account-email').type('Fikcyjny');cy.get('input[autocomplete="current-password"]').type('Browser-test-secret');cy.contains('button','Zaloguj').click();}
function back(){cy.document().then(doc=>{const handlers:{priority:number;handler:(next:()=>void)=>void}[]=[];doc.dispatchEvent(new CustomEvent('ionBackButton',{detail:{register:(priority:number,handler:(next:()=>void)=>void)=>handlers.push({priority,handler})}}));handlers.sort((a,b)=>b.priority-a.priority);const next=()=>handlers.shift()?.handler(next);next();});}
describe('B1 original UI with controlled accounts contract (not a real backend test)',()=>{
 it('credentials error, real Auth port, restore, navigation and logout',()=>{
  let valid=false;const actions:string[]=[];
  cy.intercept('POST','http://127.0.0.1:54321/functions/v1/accounts',req=>{actions.push(req.body.action);req.alias=req.body.action==='profile'?'profile':req.body.action==='profile_photo_get'?'photo':'auth';if(req.body.action==='profile_photo_get'){req.reply({image_data_url:null,revision:null,cleanup_pending:false});return;}if(req.body.action==='profile'){req.reply(ownProfile());return;}if(req.body.action==='login'&&!valid)req.reply(401,{code:'invalid_credentials'});else req.reply(req.body.action==='logout'?{}:session());}).as('accounts');
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});cy.contains('h1','Zaloguj się').should('be.visible');login();cy.wait('@auth');cy.get('[role=alert]').should('contain','Nie udało się zalogować');cy.get('.slm-demo-nav').should('not.exist');
  cy.then(()=>{valid=true;});login();cy.wait('@auth');cy.get('.slm-demo-nav').should('be.visible');cy.contains('Dane przykładowe').should('exist');
  cy.get('.slm-card-link').first().click();cy.get('[role=tab]').should('exist');back();cy.get('.slm-card-link').should('be.visible');
  cy.reload();cy.wait('@auth');cy.get('.slm-demo-nav').should('be.visible');
  cy.contains('nav button','Profil').click();cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('button','Wyloguj').click();cy.wait('@auth');cy.contains('h1','Zaloguj się').should('be.visible');cy.reload();cy.contains('h1','Zaloguj się').should('be.visible');
  cy.then(()=>{expect(actions.filter(action=>action!=='profile')).to.deep.eq(['login','login','profile_photo_get','refresh','profile_photo_get','logout']);expect(actions.filter(action=>action==='profile')).to.have.length(2);});
 });
 it('temporary password gate and expired refresh never expose demo world',()=>{
  let temporary=true,expired=false;
  cy.intercept('POST','**/functions/v1/accounts',req=>{req.alias=req.body.action==='profile'?'profile':req.body.action==='profile_photo_get'?'photo':'auth';if(req.body.action==='profile_photo_get'){req.reply({image_data_url:null,revision:null,cleanup_pending:false});return;}if(req.body.action==='profile'){req.reply(ownProfile());return;}if(expired)req.reply(401,{code:'session_invalid'});else{if(req.body.action==='password')temporary=false;req.reply(session(temporary));}}).as('accounts');
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});login();cy.wait('@auth');cy.contains('h1','Zmień hasło').should('be.visible');cy.get('.slm-demo-nav').should('not.exist');back();cy.get('.slm-demo-nav').should('not.exist');
  cy.get('input[autocomplete="current-password"]').type('Browser-test-secret');cy.get('input[autocomplete="new-password"]').eq(0).type('Updated-test-secret');cy.get('input[autocomplete="new-password"]').eq(1).type('Updated-test-secret');cy.get('form button[type=submit]').click();cy.wait('@auth');cy.get('.slm-demo-nav').should('be.visible');
  cy.then(()=>{expired=true;});cy.reload();cy.wait('@auth');cy.contains('h1','Sesja wygasła').should('be.visible');cy.get('.slm-demo-nav').should('not.exist');cy.contains('button','Wróć do logowania').click();cy.contains('h1','Zaloguj się').should('be.visible');
 });
});
