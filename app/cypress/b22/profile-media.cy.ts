describe('B2.2 original profile controls connected to server contract',()=>{
 it('saves zero/99, compresses a real image, restores, replaces and deletes without demo mutation',()=>{
  cy.viewport(390,844);
  let fullName='Testowy Zawodnik';let number:number|null=null,image:string|null=null,revision:string|null=null,sequence=0;
  const auth={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user_id:'own',role:'member',must_change_password:false};
  const profile=()=>({user_id:'own',login:'Fikcyjny',phone:'',full_name:fullName,display_as:'full_name',display_name:fullName,jersey_number:number});
  cy.intercept('POST','**/functions/v1/accounts*',req=>{
   const action=req.body.action;
   if(action==='save_profile')fullName=req.body.full_name;
   if(action==='save_jersey_number'){expect(Object.keys(req.body).sort()).deep.eq(['action','jersey_number']);number=req.body.jersey_number;}
   if(action==='profile_photo_upload'){
    expect(req.url).include('?photo=upload');expect(req.body.expected_revision).eq(revision);
    expect(req.body.image_data_url).match(/^data:image\/webp;base64,/);
    expect(Cypress.Buffer.from(req.body.image_data_url.split(',')[1],'base64').length).at.most(150000);
    image=req.body.image_data_url;revision=`11111111-1111-4111-8111-${String(++sequence).padStart(12,'0')}`;
   }
   if(action==='profile_photo_delete'){expect(req.body.expected_revision).eq(revision);image=null;revision=`11111111-1111-4111-8111-${String(++sequence).padStart(12,'0')}`;}
   req.reply(action.startsWith('profile_photo_')?{image_data_url:image,revision,cleanup_pending:false}:['profile','save_profile','save_jersey_number'].includes(action)?profile():action==='logout'?{}:auth);
  });
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});cy.get('#account-email').type('Fikcyjny');cy.get('input[autocomplete="current-password"]').type('Only-test-secret',{log:false});cy.get('form button[type=submit]').click();
  cy.contains('nav button','Profil').click();cy.contains('h2','Testowy Zawodnik').should('be.visible');
  cy.contains('button','Edytuj profil').click();cy.get('.slm-number-form').should('not.exist');
  cy.get('.slm-identity-editor input').eq(1).clear().type('Niezapisane Dane');cy.get('input[inputmode="numeric"]').type('7');cy.contains('.slm-identity-editor button','Anuluj').click();
  cy.then(()=>{expect(number).eq(null);expect(fullName).eq('Testowy Zawodnik');});
  cy.contains('button','Edytuj profil').click();cy.get('.slm-identity-editor input').eq(1).should('have.value','Testowy Zawodnik');cy.get('input[inputmode="numeric"]').should('have.value','').type('100');cy.contains('button','Zapisz dane').click();cy.get('[role="alert"]').should('contain','0 do 99');
  cy.get('.slm-identity-editor input').eq(1).clear().type('Zapisany Zawodnik');cy.get('input[inputmode="numeric"]').clear().type('0');cy.contains('button','Zapisz dane').click();cy.get('[aria-label="Numer koszulki 0"]').should('exist');cy.contains('h2','Zapisany Zawodnik').should('exist');
  cy.get('button[aria-label="Zmień numer koszulki, obecnie 0"]').click();cy.get('.slm-number-form').should('not.exist');cy.get('input[inputmode="numeric"]').clear().type('99');cy.contains('button','Zapisz dane').click();cy.get('[aria-label="Numer koszulki 99"]').should('exist');
  const choose=(resume=false)=>{if(resume){cy.get('.slm-local-file-input').trigger('click',{force:true});cy.document().then(doc=>{Object.defineProperty(doc,'visibilityState',{configurable:true,value:'hidden'});doc.dispatchEvent(new Event('visibilitychange'));});cy.get('.slm-demo-world').should('not.be.visible');cy.get('.slm-avatar-picker').should('exist');cy.document().then(doc=>{Object.defineProperty(doc,'visibilityState',{configurable:true,value:'visible'});doc.dispatchEvent(new Event('visibilitychange'));});}cy.readFile('supabase/functions/fixtures/webp.json',{log:false}).then(fixture=>{cy.get('.slm-local-file-input').selectFile({contents:Cypress.Buffer.from(fixture.base64,'base64'),fileName:'synthetic.webp',mimeType:'image/webp'},{force:true});});cy.contains('button','Zatwierdź zdjęcie').should('be.enabled').click();cy.get('.slm-ultimate-portrait').should('have.attr','data-portrait','single');cy.get('.slm-ultimate-portrait img').should('have.css','object-fit','cover');};
  cy.contains('button','Zmień zdjęcie').click();cy.get('.slm-avatar-picker').should('have.length',1);cy.get('.slm-avatar-options').should('not.exist');choose(true);cy.get('.slm-avatar-picker').should('not.exist');cy.screenshot('b22-own-photo-number',{capture:'viewport'});
  cy.reload();cy.contains('nav button','Profil').click();cy.get('[aria-label="Numer koszulki 99"]').should('exist');cy.get('.slm-ultimate-portrait').should('have.attr','data-portrait','single');cy.get('.slm-ultimate-portrait img').should('have.css','object-fit','cover');
  cy.contains('button','Zmień zdjęcie').click();cy.get('.slm-avatar-picker').then(target=>{cy.get('ion-content').filter(':visible').first().then(async elements=>{const scroll=await (elements[0] as unknown as {getScrollElement:()=>Promise<HTMLElement>}).getScrollElement();scroll.scrollTop+=target[0].getBoundingClientRect().top-scroll.getBoundingClientRect().top;});});cy.wait(100);cy.screenshot('b22-original-picker-with-delete',{capture:'viewport'});choose();
  cy.contains('button','Zmień zdjęcie').click();cy.contains('button','Usuń zdjęcie').click();cy.get('.slm-ultimate-portrait').should('have.attr','data-portrait','initials');
  cy.reload();cy.contains('nav button','Profil').click();cy.get('.slm-ultimate-portrait').should('have.attr','data-portrait','initials');
  cy.get('.slm-ultimate-stats dd').each(el=>expect(el.text()).eq('—'));
  cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('button','Wyloguj').click();cy.contains('h1','Zaloguj się').should('be.visible');cy.get('.slm-ultimate-portrait').should('not.exist');
 });
 it('changes only a legacy login with password, handles a server conflict and restores the new identity',()=>{
  let login='Fikcyjny';
  const session={access_token:'legacy-access',refresh_token:'legacy-refresh',expires_in:3600,user_id:'legacy-own',role:'member',must_change_password:false};
  const profile=()=>({user_id:'legacy-own',login,phone:'+48000000999',full_name:'Testowy Zawodnik',display_as:'full_name',display_name:'Testowy Zawodnik',jersey_number:27,email_account:false});
  cy.intercept('POST','**/functions/v1/accounts*',req=>{
   const action=req.body.action;
   if(action==='identifiers'){
    expect(req.body.phone).eq('+48000000999');expect(req.body.current_password).eq('Only-current-test-secret');
    if(req.body.login==='ZajetyLogin'){req.reply(409,{code:'identifier_taken',error:'Login zajęty'});return;}
    login=req.body.login;
   }
   if(action==='login'&&req.body.identifier!==login){req.reply(401,{code:'invalid_credentials'});return;}
   req.reply(action==='profile_photo_get'?{image_data_url:null,revision:null,cleanup_pending:false}:['profile','save_profile'].includes(action)?profile():action==='logout'?{}:session);
  });
  const signIn=(name:string)=>{cy.get('#account-email').type(name);cy.get('input[autocomplete="current-password"]').type('Only-current-test-secret',{log:false});cy.get('form button[type=submit]').click();cy.contains('nav button','Profil').click();};
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});signIn('Fikcyjny');cy.contains('button','Edytuj profil').click();
  cy.get('.slm-identity-editor input').first().should('not.have.attr','readonly');cy.get('.slm-identity-editor input').first().clear().type('ZajetyLogin');
  cy.contains('.slm-identity-editor button','Zapisz dane').click();cy.get('[role="alert"]').should('contain','obecnego hasła');
  cy.get('.slm-identity-editor input[type="password"]').type('Only-current-test-secret',{log:false});cy.contains('.slm-identity-editor button','Zapisz dane').click();cy.get('[role="alert"]').should('contain','Nie potwierdzono');
  cy.get('.slm-identity-editor input').first().clear().type('NowyLogin');cy.get('.slm-identity-editor input[type="password"]').type('Only-current-test-secret',{log:false});cy.contains('.slm-identity-editor button','Zapisz dane').click();cy.get('.slm-identity-editor').should('not.exist');
  cy.reload();cy.contains('nav button','Profil').click();cy.contains('summary','Ustawienia aplikacji i konta').click();cy.contains('Login: NowyLogin').should('exist');cy.get('[aria-label="Numer koszulki 27"]').should('exist');
  cy.contains('button','Wyloguj').click();signIn('NowyLogin');cy.contains('h2','Testowy Zawodnik').should('exist');
 });

});
