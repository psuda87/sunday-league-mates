import { openProfile } from '../support/navigation';
const back=()=>cy.document().then(doc=>{doc.dispatchEvent(new CustomEvent('backbutton'));return new Cypress.Promise(resolve=>setTimeout(resolve,50));});
function fixture(theme:string,count=24) {
 const uid=crypto.randomUUID(),gid=crypto.randomUUID(),mid=crypto.randomUUID();
 const session={user_id:uid,access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,role:'member',must_change_password:false};
 const event={id:mid,group_id:gid,group_name:'TEST Premium · bardzo długa nazwa grupy piłkarskiej',name:'TEST Premium 3.20 · mecz',visibility:'private',access:'full',starts_at:'2099-10-19T17:00:00Z',location:'TEST · boisko',status:'scheduled',duration_minutes:90,capacity:40,registered_count:count,reserve_count:2,registration_open:true,can_manage:true,can_edit:true,cost_cents:27000,total_cost:270,hourly_rate:180,version:1};
 const group={id:gid,name:event.group_name,admin_id:uid,organizer:true};
 const entries=Array.from({length:count+2},(_,i)=>({id:'entry-'+i,member_id:i===0?uid:crypto.randomUUID(),responsible_user_id:uid,status:i<count?'registered':'reserve',absent:false,display_name:i===0?'TEST Aleksander BardzoDługieNazwiskoABCDEFGHIJKLMNOPQRSTUVWXYZ':`TEST Zawodnik ${i}`,responsible_name:'TEST Opiekun',contact_phone:''}));
 cy.intercept('POST','**/functions/v1/accounts*',req=>{
  switch(req.body.action){
   case 'login':case 'refresh':case 'status':req.reply(session);break;
   case 'profile':req.reply({user_id:uid,display_name:'TEST Aleksander',login:'TEST Aleksander',phone:'',full_name:'',display_as:'nickname',email_account:true});break;
   case 'profile_photo_get':req.reply({image_data_url:null,revision:null});break;
   case 'groups_list':case 'finance_groups':req.reply({groups:[group]});break;
   case 'groups_inbox':req.reply({requests:[]});break;
   case 'matches_list':req.reply({events:[event],server_now:'2026-10-23T12:00:00Z'});break;
   case 'matches_detail':req.reply({event,participants:entries,server_now:'2026-10-23T12:00:00Z',can_register_paid:true});break;
   case 'notifications_count':req.reply({unread:0});break;
   default:req.reply({ok:true});
  }
 });
 cy.visit('/',{onBeforeLoad:win=>win.localStorage.setItem('slm.appearance',theme)});
 cy.get('input[type=password]').type(crypto.randomUUID(),{log:false});
 cy.get('ion-input').filter((_,e)=>(e as unknown as {label:string}).label==='E-mail, login lub numer telefonu').find('input').type('synthetic@fixture.invalid');
 cy.contains('ion-button','Zaloguj się').click();
 cy.get('.slm-card-link').click();cy.contains('h1','Szczegóły meczu').should('be.visible');
 return {uid,entries};
}
function noOverflow(){cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));}
describe('Premium 3.20 — zatwierdzone komponenty na prawdziwych trasach',()=>{
 for(const width of [320,360,390,430])for(const theme of ['light','dark']){
  it(`${width}px ${theme}: lista, profil, ręczny podgląd i stopka`,()=>{
   cy.viewport(width,844);const {entries}=fixture(theme);
   cy.get('.slm-live-roster .slm-roster-avatar').should('have.length',7);
   cy.get('.slm-live-roster .slm-person-actions').each(element=>expect((element[0] as HTMLDetailsElement).open).to.equal(false));
   cy.contains('button','Pokaż wszystkich (24)').click();cy.get('.slm-live-roster .slm-roster-avatar').should('have.length',26);noOverflow();
   cy.contains('button',entries[0].display_name).click();cy.contains('ion-title','Profil zawodnika').should('be.visible');
   back();cy.get('ion-modal').should('not.exist');cy.contains('h1','Szczegóły meczu').should('be.visible');
   cy.contains('[role=tab]','Składy').click();cy.contains('Lokalny podgląd · bez losowania').should('be.visible');
   cy.get('.slm-football-pitch .slm-pitch-player').should('not.exist');
   cy.contains('summary','Ustaw lokalny podział').click();
   cy.get('.slm-local-lineup-editor select').should('have.length',24).each((el,index)=>{if(index<10)cy.wrap(el).select(index%2?'b':'a');});
   cy.get('.slm-football-pitch .slm-pitch-player').should('have.length',10);noOverflow();
   cy.get('.slm-football-pitch').then(p=>{const box=p[0].getBoundingClientRect();expect(box.height).to.be.greaterThan(box.width);});
   cy.get('.slm-football-pitch button').first().click();back();cy.contains('[role=tab][aria-selected=true]','Składy').should('exist');
   cy.get('.slm-live-create').then(plus=>{cy.get('button[data-tab=groups]').then(group=>{const a=plus[0].getBoundingClientRect(),b=group[0].getBoundingClientRect();expect(a.width).to.equal(56);expect(a.bottom).to.be.at.most(b.top);});});
   cy.contains('nav.slm-bottom-nav button','Mecze').click();cy.get('.slm-card-link').click();cy.contains('[role=tab]','Składy').click();
   cy.get('.slm-football-pitch .slm-pitch-player').should('not.exist');
   openProfile();noOverflow();
  });
 }
 it('pusta lista nie wymyśla zawodników ani numerów',()=>{
  fixture('dark',0);cy.contains('h3','Zapisani').closest('section').should('contain','Brak wpisów.');
  cy.contains('[role=tab]','Składy').click();cy.contains('Boisko czeka na zapisanych uczestników.').should('be.visible');
  cy.get('.slm-football-pitch .slm-pitch-player').should('not.exist');
 });
});
