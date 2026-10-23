import { openProfile } from '../support/navigation';

const back=()=>cy.document().then(doc=>{doc.dispatchEvent(new CustomEvent('backbutton'));return new Cypress.Promise(resolve=>setTimeout(resolve,50));});
function fixture(theme='dark') {
 const session={user_id:crypto.randomUUID(),access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,role:'member',must_change_password:false};
 const group={id:crypto.randomUUID(),name:'TEST Bardzo długa nazwa grupy piłkarskiej z długim wyrazem ABCDEFGHIJKLMNOPQRSTUVWXYZ',description:'Test zawijania tekstów i akcji',admin_id:session.user_id,organizer:true};
 const base={id:crypto.randomUUID(),name:'Bardzo długi tytuł meczu piłkarskiego Premium z dodatkowymi informacjami',group_id:group.id,group_name:group.name,visibility:'private',starts_at:'2099-10-19T17:00:00Z',location:'Długa nazwa boiska i adresu testowego przy ulicy sportowej',status:'scheduled'};
 const full={...base,access:'full',duration_minutes:90,capacity:14,registered_count:4,reserve_count:2,registration_open:true,decision_required:false,total_cost:270,hourly_rate:180,cost_cents:27000,version:1,can_manage:true,can_edit:true};
 let photo:{image_data_url:string|null;revision:string|null}={image_data_url:null,revision:null};
 cy.intercept('POST','**/functions/v1/accounts*',req=>{
  const a=req.body.action;
  if(a==='login'||a==='refresh')req.reply(session);
  else if(a==='status')req.reply({...session});
  else if(a==='profile')req.reply({user_id:session.user_id,login:'Premium Tester',phone:'',full_name:'',display_as:'nickname',display_name:'Premium Tester',email_account:true});
  else if(a==='groups_list'||a==='finance_groups')req.reply({groups:[group]});
  else if(a==='groups_inbox')req.reply({requests:[{id:crypto.randomUUID(),group_id:group.id,group_name:group.name,kind:'invite',state:'pending'}]});
  else if(a==='groups_detail')req.reply({group,members:[{user_id:session.user_id,nickname:'Premium Tester',organizer:true},{user_id:crypto.randomUUID(),nickname:'BardzoDługiPseudonimABCDEFGHIJKLMNOPQRSTUVWXYZ',organizer:false}],requests:[]});
  else if(a==='matches_list')req.reply({events:[full,{...base,id:'limited-event',access:'none',registered_count:999,reserve_count:888}],server_now:'2026-10-23T12:00:00Z'});
  else if(a==='matches_detail')req.reply({event:full,participants:[],server_now:'2026-10-23T12:00:00Z',can_register_paid:true});
  else if(a==='profile_photo_get')req.reply(photo);
  else if(a==='profile_photo_upload'){expect(req.body.image_data_url).to.match(/^data:image\/jpeg;base64,/);photo={image_data_url:req.body.image_data_url,revision:crypto.randomUUID()};req.reply(photo);}
  else if(a==='profile_photo_delete'){photo={image_data_url:null,revision:crypto.randomUUID()};req.reply(photo);}
  else if(a==='group_finance_account')req.reply({balance_cents:-1700,registration_allowed:true,dues:[],payments:[],surplus:[]});
  else if(a==='notifications_count')req.reply({unread:0});
  else req.reply({ok:true});
 });
 cy.visit('/',{onBeforeLoad:win=>win.localStorage.setItem('slm.appearance',theme)});
 noOverflow();
 cy.get('ion-input').filter((_,el)=>(el as unknown as {label:string}).label==='E-mail, login lub numer telefonu').find('input').type('fixture@fixture.invalid');
 cy.get('input[type="password"]').type(crypto.randomUUID(),{log:false});
 cy.contains('ion-button','Zaloguj się').click();
 return {group};
}
function noOverflow(){cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));}
function chooseSyntheticPhoto(){
 cy.contains('ion-button',/Dodaj zdjęcie|Zmień zdjęcie/).click();
 cy.window().then(win=>{
  const canvas=win.document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d')!;context.fillStyle='#D4AF37';context.fillRect(0,0,64,64);
  const data=canvas.toDataURL('image/png').split(',')[1];
  cy.get('input[type=file]').selectFile({contents:Cypress.Buffer.from(data,'base64'),fileName:'fixture.png',mimeType:'image/png'},{force:true});
 });
}

describe('Premium 3.19 — regresja Android i układu',()=>{
 for(const width of [320,360,390,430])for(const theme of ['light','dark'])for(const landscape of [false,true]){
  it(`${width}px ${theme} ${landscape?'poziomo':'pionowo'}`,()=>{
   cy.viewport(landscape?844:width,landscape?width:844);fixture(theme);
   cy.get('.slm-limited-match').should('be.visible').and('not.contain','999').and('not.contain','888');noOverflow();
   if(width===390&&!landscape)cy.screenshot(`premium319-matches-${theme}`,{capture:'viewport'});
   cy.get('.slm-card-link').first().click();cy.contains('h1','Szczegóły meczu').should('be.visible');noOverflow();
   cy.contains('summary','Dodaj gościa').should('exist');
   for(const label of ['Informacje','Składy','Rozliczenie','Uczestnicy']){cy.contains('[role=tab]',label).click();noOverflow();}
   back();cy.contains('h1','Mecze').should('be.visible');
   cy.contains('ion-button','Utwórz mecz').click();cy.get('input[placeholder="HH:mm"]').should('have.value','');noOverflow();
   back();cy.contains('h1','Mecze').should('be.visible');
   cy.contains('nav.slm-bottom-nav button','Grupy').click();
   cy.get('.slm-group-request ion-button').should('have.length',2);noOverflow();
   cy.get('.slm-group-request ion-button').then(buttons=>{
    const first=buttons[0].getBoundingClientRect(),second=buttons[1].getBoundingClientRect();
    expect(first.height).to.be.at.least(44);expect(second.height).to.be.at.least(44);
    expect(first.right<=second.left+1||first.bottom<=second.top+1).to.equal(true);
   });
   if(width===390&&!landscape)cy.screenshot(`premium319-groups-${theme}`,{capture:'viewport'});
   openProfile();cy.contains('summary','Edytuj profil i dane konta').click();
   cy.get('.slm-password-field').then(fields=>{
    for(let i=1;i<fields.length;i++){
     const prior=fields[i-1].getBoundingClientRect(),next=fields[i].getBoundingClientRect();
     if(next.top>prior.top)expect(next.top-prior.bottom).to.be.within(8,32);
    }
    fields.each((_,el)=>expect(el.getBoundingClientRect().height).to.be.lessThan(135));
   });noOverflow();
   cy.contains('summary','Ustawienia aplikacji i konta').click();noOverflow();
   cy.contains('nav[aria-label=Konto] ion-button','Rozliczenia').click();cy.contains('h2','Moje saldo w grupie').should('exist');noOverflow();
  });
 }
 it('Wstecz zamyka szczegóły, rozwijane ustawienia i przywraca historię zakładek',()=>{
  const {group}=fixture();
  cy.contains('nav.slm-bottom-nav button','Grupy').click();cy.contains('button',group.name).click();
  cy.contains('h2','Członkowie').should('be.visible');back();cy.contains('h2','Moje grupy').should('be.visible');
  openProfile();cy.contains('summary','Ustawienia aplikacji i konta').click();back();
  cy.get('.slm-live-profile details[open]').should('not.exist');back();cy.contains('h1','Grupy').should('be.visible');
  back();cy.contains('h1','Mecze').should('be.visible');back();cy.contains('h1','Mecze').should('be.visible');
 });
 it('klawiatura ukrywa footer i Wstecz nie opuszcza profilu przy jej zamknięciu',()=>{
  fixture();openProfile();cy.window().then(win=>win.dispatchEvent(new Event('ionKeyboardDidShow')));
  cy.get('ion-footer').should('not.be.visible');back();cy.get('ion-footer').should('be.visible');cy.contains('h1','Mój profil').should('be.visible');
 });
 it('galeria, podgląd, modal Wstecz, zapis i ponowne otwarcie zdjęcia',()=>{
  fixture();openProfile();cy.contains('ion-button','Dodaj zdjęcie').should('not.be.disabled');
  chooseSyntheticPhoto();cy.contains('ion-title','Podgląd zdjęcia').should('be.visible');back();
  cy.contains('ion-title','Podgląd zdjęcia').should('not.exist');cy.contains('h1','Mój profil').should('be.visible');
  chooseSyntheticPhoto();cy.contains('ion-modal ion-button','Zapisz zdjęcie').click();
  cy.get('.slm-ultimate-portrait img').should('have.attr','src').and('match',/^data:image\/jpeg/);
  cy.reload();openProfile();cy.get('.slm-ultimate-portrait img').should('be.visible');
  cy.contains('ion-button','Usuń zdjęcie').click();cy.get('[data-portrait="initials"]').should('be.visible');
 });
});
