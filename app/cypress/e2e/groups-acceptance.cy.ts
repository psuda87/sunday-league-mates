describe('Odbiór grup Premium — kontrolowany transport, mobilnie',()=>{
 const uid='00000000-0000-4000-8000-000000000001',gid='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
 let requests=0,pending=true,outgoing=false,hasGroup=true;
 const group={id:gid,name:'Ekipa testowa',description:'Opis właściciela',admin_id:uid,organizer:true,member_count:1,pending_count:1};
 beforeEach(()=>{
  requests=0;pending=true;outgoing=false;hasGroup=true;cy.viewport(390,844);cy.clearLocalStorage();
  cy.intercept('POST','**/functions/v1/accounts**',req=>{
   const a=req.body.action;
   if(['login','refresh'].includes(a))req.reply({user_id:uid,access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,role:'member',must_change_password:false});
   else if(a==='profile')req.reply({user_id:uid,login:'Fixture',nickname:'Fixture',first_name:'',full_name:'',phone:'',email_account:true,jersey_number:null,display_as:'nickname',display_name:'Fixture',group_scope:[]});
   else if(a==='profile_photo_get')req.reply({image_data_url:null,revision:null,cleanup_pending:false});
   else if(a==='matches_list')req.reply({events:[],server_now:'2030-01-01T00:00:00Z'});
   else if(['groups_list','finance_groups'].includes(a))req.reply({groups:hasGroup?[{...group,pending_count:pending?1:0}]:[]});
   else if(a==='groups_inbox')req.reply({requests:[],outgoing:outgoing?[{id:'mine',group_id:other,group_name:'Oczekująca ekipa',kind:'join',state:'pending',actor_id:uid,target_id:uid},{id:'old',group_id:'old',group_name:'Anulowana ekipa',kind:'join',state:'cancelled',actor_id:uid,target_id:uid}]:[]});
   else if(a==='groups_detail')req.reply({group,members:[{user_id:uid,nickname:'Fixture',display_name:'Fixture',full_name:null,contact_phone:null,jersey_number:null,organizer:true,joined_at:'2026-01-01',share_full_name:false}],requests:pending?[{id:'req',group_id:gid,kind:'join',state:'pending',target_id:'player',target_name:'Kandydat',actor_id:'player'}]:[]});
   else if(a==='groups_search')req.reply({groups:[{id:other,name:'Znaleziona ekipa',description:'Opis znalezionej grupy',member_count:12}]});
   else if(a==='groups_join'){requests++;req.reply({ok:true});}
   else if(a==='groups_cancel_request'){outgoing=false;req.reply({ok:true});}
   else if(a==='groups_decide'){pending=false;req.reply({ok:true});}
   else req.reply({statusCode:400,body:{code:'unexpected_fixture',error:a}});
  });
  cy.visit('/');cy.get('input[autocomplete="username"]').type('Fixture');cy.get('input[autocomplete="current-password"]').type('fixture-password',{log:false});cy.contains('button','Zaloguj').click();
 });
 it('nawiguje dzwonkiem do właściwej grupy i pokazuje licznik przed otwarciem panelu',()=>{
  cy.get('button[aria-label="Oczekujące zgłoszenia do grup: 1"]').should('be.visible');cy.screenshot('groups-bell-mobile');cy.get('button[aria-label="Oczekujące zgłoszenia do grup: 1"]').click();cy.contains('.slm-group-notifications button','Ekipa testowa').click();
  cy.location('hash').should('eq','#group/'+gid);cy.contains('button','Zarządzaj grupą').should('contain','1');
  cy.contains('Wspólna ekipa piłkarska').should('not.exist');cy.contains('Opis właściciela').should('be.visible');
  cy.contains('button','Zarządzaj grupą').click();cy.contains('button','Akceptuj zgłoszenie').click();cy.contains('button','Zarządzaj grupą').should('not.contain','1');
  cy.screenshot('groups-management-mobile');
 });
 it('nie wysyła prośby przed potwierdzeniem; anulowanie niczego nie wysyła',()=>{
  cy.get('nav[aria-label="Główna nawigacja"] button[data-tab="groups"]').click();cy.contains('button','Znajdź grupę').click();cy.get('#group-query').type('ek');
  cy.contains('Znaleziona ekipa').should('be.visible');cy.contains('button','Poproś o dołączenie').click();
  cy.get('ion-alert').should('be.visible');cy.then(()=>expect(requests).eq(0));cy.get('ion-alert:not(.overlay-hidden) button').contains('Anuluj').click();cy.get('ion-alert').should('not.be.visible');
  cy.then(()=>expect(requests).eq(0));cy.contains('button','Poproś o dołączenie').click();cy.get('ion-alert:not(.overlay-hidden) button').contains('Potwierdź').click();cy.wrap(null).should(()=>expect(requests).eq(1));
  cy.get('.slm-group-search-result').should('be.visible');cy.document().then(doc=>expect(doc.documentElement.scrollWidth).lte(390));cy.screenshot('groups-search-mobile');
 });
 it('pokazuje tylko oczekujące własne prośby, pozwala je anulować i nie dodaje pustego komunikatu zaproszeń',()=>{
  outgoing=true;cy.get('nav[aria-label="Główna nawigacja"] button[data-tab="groups"]').click();
  cy.contains('Oczekująca ekipa').should('be.visible');cy.contains('Anulowana ekipa').should('not.exist');cy.contains('Nie masz oczekujących zaproszeń').should('not.exist');
  cy.contains('button','Anuluj prośbę').click();cy.contains('Oczekująca ekipa').should('not.exist');
 });
 it('pokazuje pełny przycisk Premium bez grup i zachowuje nawigację',()=>{
  hasGroup=false;cy.get('ion-button[aria-label="Odśwież mecze"]').filter(':visible').click();
  cy.contains('button','Przejdź do grup').should('be.visible').find('ion-icon').should('exist');cy.screenshot('groups-cta-mobile');
  cy.contains('button','Przejdź do grup').click();cy.location('hash').should('eq','#groups');
 });

});
