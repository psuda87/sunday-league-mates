// Existing Premium production build + controlled transport. No real account or
// Cloud request is created; SQL/RLS is exercised separately in the scratch DB.
describe('Prywatność telefonu i usuwanie konta Premium',()=>{
 const uid='00000000-0000-4000-8000-000000000001';
 const session={user_id:uid,access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,role:'member',must_change_password:false};
 let profile:Record<string,unknown>;
 let deletion:{operation_id:string;proof:string}|null;
 function install(){
  profile={user_id:uid,login:'PrivacyFixture',nickname:'PrivacyFixture',first_name:'',full_name:'',phone:'+48000000001',share_phone:false,email_account:true,jersey_number:null,display_as:'nickname',display_name:'PrivacyFixture',group_scope:[]};deletion=null;
  cy.intercept('POST','**/functions/v1/accounts**',req=>{
   const b=req.body;
   if(['login','refresh'].includes(b.action))req.reply(session);
   else if(b.action==='profile')req.reply(profile);
   else if(b.action==='profile_photo_get')req.reply({image_data_url:null,revision:null,cleanup_pending:false});
   else if(b.action==='matches_list')req.reply({events:[],server_now:new Date().toISOString()});
   else if(['groups_list','finance_groups'].includes(b.action))req.reply({groups:[]});
   else if(b.action==='groups_inbox')req.reply({requests:[]});
   else if(b.action==='save_contact_phone'){
    expect(b.current_password).to.eq('fixture-current-password');
    profile={...profile,phone:b.phone,share_phone:b.share_phone};req.reply(profile);
   }else if(b.action==='account_delete'){
    expect(b.confirmation).to.eq('USUŃ KONTO');expect(b.current_password).to.eq('fixture-current-password');
    deletion={operation_id:b.operation_id,proof:b.proof};req.reply({statusCode:503,body:{code:'deletion_pending',error:'Fixture partial outage'}});
   }else if(b.action==='account_delete_resume'){
    expect({operation_id:b.operation_id,proof:b.proof}).to.deep.eq(deletion);expect(b.current_password).to.eq(undefined);
    req.reply({deleted:true,operation_id:b.operation_id});
   }else if(b.action==='logout')req.reply({ok:true});
   else req.reply({statusCode:400,body:{code:'unexpected_fixture_action',error:'Unexpected fixture request'}});
  }).as('accounts');
 }
 function login(){
  cy.visit('/');cy.get('input').filter('[autocomplete="username"]').type('PrivacyFixture');
  cy.get('input[autocomplete="current-password"]').type('fixture-current-password',{log:false});
  cy.contains('button','Zaloguj').click();cy.get('nav[aria-label="Główna nawigacja"] button[data-tab="profile"]').click();
  cy.contains('.slm-ultimate-nameplate h2','PrivacyFixture',{matchCase:false}).should('be.visible');
 }
 beforeEach(()=>{cy.clearLocalStorage();install();});
 it('shows opt-in as off and persists number removal with sharing disabled',()=>{
  login();cy.contains('button','Edytuj profil').click();
  cy.contains('label','Udostępniaj mój numer telefonu członkom moich grup').find('input').should('not.be.checked');
  cy.get('form[aria-label="Zmiana telefonu"]').within(()=>{
   cy.get('input[type="tel"]').clear();cy.get('input[type="password"]').type('fixture-current-password',{log:false});cy.contains('button','Zmień telefon').click();
  });
  cy.contains('[role="status"]','Potwierdzono telefon').should('be.visible');
  cy.contains('button','Edytuj profil').click();cy.get('form[aria-label="Zmiana telefonu"] input[type="tel"]').should('have.value','');
 });
 it('requires confirmation, retains the retry capability after a partial failure and logs out only after success',()=>{
  login();cy.contains('button','Ustawienia').click();cy.contains('button','Usuń konto').click();
  cy.get('form[aria-label="Usuwanie konta"]').within(()=>{
   cy.contains('button','Nieodwracalnie usuń moje konto').click();cy.get('[role="alert"]').should('contain','USUŃ KONTO');
   cy.get('input[type="password"]').type('fixture-current-password',{log:false});cy.get('input').not('[type="password"]').type('USUŃ KONTO');
   cy.contains('button','Nieodwracalnie usuń moje konto').click();cy.contains('button','Ponów sprawdzenie usuwania').should('be.visible');
   cy.get('input[type="password"]').should('not.exist');cy.contains('button','Ponów sprawdzenie usuwania').click();
  });
  cy.contains('h1','Zaloguj się').should('be.visible');cy.window().then(w=>expect(w.localStorage.getItem('slm.auth.hjtcyybkxebvdropchac.refresh.v1')).to.eq(null));
 });
});
