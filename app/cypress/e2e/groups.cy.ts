import { accountAction } from '../support/navigation';
describe('Grupy i finanse v2 — UI z kontrolowanym API',()=>{
 const input=(label:string,value:string)=>cy.get('ion-input').filter((_,el)=>(el as unknown as {label:string}).label===label).find('input').clear({log:false}).type(value,{log:false});
 const s={access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,user_id:crypto.randomUUID(),role:'member',must_change_password:false};
 const gid=crypto.randomUUID();
 const group={id:gid,name:'Ekipa testowa',description:'Tylko fixture UI',admin_id:s.user_id,organizer:true};
 function install(){cy.intercept('POST','**/functions/v1/accounts',req=>{
  const a=req.body.action;
  if(a==='login')req.reply(s);
  else if(a==='profile')req.reply({user_id:s.user_id,login:'Fixture',phone:'',full_name:'',display_as:'nickname',display_name:'Fixture',email_account:true});
  else if(a==='matches_list')req.reply({events:[],server_now:'2026-10-19T12:00:00Z'});
  else if((a==='groups_list'||a==='finance_groups'))req.reply({groups:[group]});
  else if(a==='groups_inbox')req.reply({requests:[]});
  else if(a==='groups_detail')req.reply({group,members:[{user_id:s.user_id,nickname:'Fixture',organizer:true}],requests:[]});
  else if(a==='group_finance_account')req.reply({balance_cents:-2500,registration_allowed:false,dues:[],payments:[],surplus:[{event_id:crypto.randomUUID(),assessed_cents:500,received_cents:0}]});
  else req.reply({ok:true});
 });}
 function login(){cy.visit('/');input('E-mail, login lub numer telefonu','fixture@example.invalid');input('Hasło',crypto.randomUUID());cy.contains('ion-button','Zaloguj się').click();}
 it('otwiera własną grupę i pokazuje rolę administratora grupy niezależnie od roli konta',()=>{install();login();cy.contains('nav[aria-label="Główna nawigacja"] button','Grupy').click();cy.contains('button','Ekipa testowa').click();cy.contains('h2','Członkowie').should('be.visible');cy.contains('Administrator grupy').should('be.visible');cy.contains('h2','Zaproś').should('be.visible');cy.contains('Zarządzaj kontami').should('not.exist');});
 it('formularz grupowego meczu nie zgaduje godziny ani limitu',()=>{install();login();cy.contains('ion-button','Utwórz mecz').click();cy.get('input[placeholder="HH:mm"]').should('have.value','');cy.contains('label','Limit miejsc').find('input').should('have.value','');cy.contains('label','Czas gry (min)').find('input').should('have.value','90');cy.contains('label','Koszt całkowity (zł)').find('input').should('have.value','270');cy.contains('ion-button','Czwartek').click();cy.get('input[placeholder="DD.MM.RRRR"]').should('have.value','22.10.2026');});
 it('oddziela saldo grupy, globalny status zapisów i nadwyżki naliczone od otrzymanych',()=>{install();login();accountAction('Rozliczenia');cy.contains('h2','Moje saldo w grupie').should('contain','25');cy.contains('Zaległości blokują nowe zapisy na płatne mecze w SLM.').should('be.visible');cy.contains('Naliczone:').should('contain','5,00').and('contain','0,00');cy.contains('Zgłoszenie nie jest potwierdzeniem otrzymania pieniędzy.').should('be.visible');});
});
