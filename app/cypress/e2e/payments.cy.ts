describe('Płatności z własnego profilu Premium',()=>{
 const uid='00000000-0000-4000-8000-000000000001',gid='20000000-0000-4000-8000-000000000001',eid='30000000-0000-4000-8000-000000000001';
 it('zgłasza kwotę i mecz bez opisu, pokazuje oczekiwanie oraz osobną historię',()=>{
  let pending=false;
  const account=()=>({group_id:gid,user_id:uid,balance_cents:-2300,registration_allowed:true,dues:[{event_id:eid,starts_at:'2026-11-04T18:00:00Z',due_cents:2300,covered_cents:0,outstanding_cents:2300}],payments:pending?[{id:'receipt',group_id:gid,event_id:eid,user_id:uid,corrected_amount_cents:2300,status:'pending'}]:[],history:[],surplus:null});
  cy.intercept('POST','**/functions/v1/accounts**',req=>{
   const b=req.body;
   if(['login','refresh'].includes(b.action))req.reply({user_id:uid,access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,role:'member',must_change_password:false});
   else if(b.action==='profile')req.reply({user_id:uid,login:'PaymentFixture',nickname:'PaymentFixture',first_name:'',full_name:'',phone:'',email_account:true,jersey_number:null,display_as:'nickname',display_name:'PaymentFixture',group_scope:[]});
   else if(b.action==='profile_photo_get')req.reply({image_data_url:null,revision:null,cleanup_pending:false});
   else if(b.action==='matches_list')req.reply({events:[],server_now:new Date().toISOString()});
   else if(['groups_list','finance_groups'].includes(b.action))req.reply({groups:[]});
   else if(b.action==='groups_inbox')req.reply({requests:[]});
   else if(b.action==='group_finance_wallet')req.reply({accounts:[{group_id:gid,group_name:'Grupa płatności fixture',account:account(),events:[{id:eid,name:'Mecz płatności fixture',starts_at:'2026-11-04T18:00:00Z'}]}]});
   else if(b.action==='group_finance_account')req.reply(account());
   else if(b.action==='group_finance_submit_payment'){
    expect(b.amount_cents).to.eq(2300);expect(b.event_id).to.eq(eid);expect(b.group_id).to.eq(gid);
    expect(b.reason).to.eq('Zgłoszenie wpłaty przez zawodnika');expect(b.request_id).to.be.a('string');
    pending=true;req.reply({ok:true,group_id:gid});
   }else req.reply({statusCode:400,body:{code:'unexpected_fixture_action',error:'Unexpected fixture action'}});
  });
  cy.viewport(390,844);cy.clearLocalStorage();cy.visit('/');
  cy.get('input[autocomplete="username"]').type('PaymentFixture');cy.get('input[autocomplete="current-password"]').type('fixture-password',{log:false});cy.contains('button','Zaloguj').click();
  cy.get('nav[aria-label="Główna nawigacja"] button[data-tab="profile"]').click();
  cy.contains('button','Moje płatności').click();
  cy.get('form[aria-label="Zgłoś własną wpłatę"]').within(()=>{
   cy.get('input').should('have.length',1).type('23');cy.get('select').select(eid);cy.contains('button','Zgłoś do zatwierdzenia').click();
  });
  cy.contains('p','oczekiwanie na decyzję').should('be.visible');
  cy.get('form[aria-label="Zgłoś własną wpłatę"] select option').should('have.length',1);
  cy.contains('[role="tab"]','Historia wpłat').click();cy.contains('article','Zgłoszono wpłatę').should('be.visible');
  cy.screenshot('payments-own-profile-mobile');
 });
});
