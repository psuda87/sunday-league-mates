// Real Supabase HTTP: only redirect the LOCAL endpoint to the isolated LOCAL stack.
describe('PR16 profile and atomic privacy',()=>{
 it('persists names, cancels without writes, prevents double submit and revokes in two groups',()=>{
  let saves=0;
  cy.viewport(390,844);
  cy.intercept('**/functions/v1/accounts*',req=>{
   if(!req.url.startsWith('http://127.0.0.1:54321/'))throw Error('Only local URL allowed');
   if(req.body?.action==='save_premium_profile')saves++;
   req.url=req.url.replace('127.0.0.1:54321','127.0.0.1:56321');req.continue();
  });
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});
  cy.env(['slm_email','slm_password'],{log:false}).then(v=>{cy.get('#account-email').type(String(v.slm_email),{log:false});cy.get('input[autocomplete="current-password"]').type(String(v.slm_password),{log:false});});
  cy.contains('button','Zaloguj').click();cy.get('.slm-demo-nav').should('be.visible');cy.contains('nav button','Profil').click();
  cy.contains('button','Edytuj profil').click();cy.get('.slm-premium-identity').should('be.visible');
  cy.get('.slm-premium-identity select').select('full_name');cy.contains('button','Zapisz dane').click();cy.get('ion-alert:visible').should('be.visible');
  cy.get('ion-alert:visible').then(el=>{const dismissed=new Cypress.Promise(resolve=>el[0].addEventListener('ionAlertDidDismiss',resolve,{once:true}));cy.wrap(el).contains('button','Anuluj').click();cy.then(()=>dismissed);});cy.get('ion-alert:visible').should('not.exist');cy.then(()=>expect(saves).to.equal(0));
  cy.get('.slm-premium-identity select').select('first_name');cy.contains('button','Zapisz dane').click();cy.get('ion-alert:visible').contains('button','Akceptuję').click();
  cy.get('.slm-premium-identity').should('not.exist');cy.then(()=>expect(saves).to.equal(1));cy.reload();cy.contains('nav button','Profil').click();cy.contains('.slm-ultimate-card','Given').should('be.visible');
  cy.contains('button','Edytuj profil').click();cy.get('.slm-premium-identity select').should('have.value','first_name');
  cy.get('.slm-premium-identity input').first().clear().type('Browser Public');cy.get('.slm-premium-identity select').select('nickname');
  cy.contains('button','Zapisz dane').then(button=>{button[0].click();button[0].click();});cy.get('.slm-premium-identity').should('not.exist');cy.then(()=>expect(saves).to.equal(2));
  cy.contains('button','Edytuj profil').click();cy.get('.slm-premium-identity select').select('first_name');cy.contains('button','Zapisz dane').click();cy.get('.slm-premium-identity').should('not.exist');
  cy.contains('nav button','Grupy').click();cy.contains('.slm-group-card','PR16 Alpha').click();cy.contains('button','Ukryj udostępnione imię').should('be.visible');
  for(const theme of ['light','dark']){
   cy.document().then(d=>d.documentElement.classList.toggle('ion-palette-dark',theme==='dark'));
   for(const width of [320,360,390,430]){cy.viewport(width,844);cy.get('.slm-group-hide-first').then(el=>{const r=el[0].getBoundingClientRect();expect(r.width).to.be.greaterThan(48);expect(r.height).to.be.at.least(44);expect(r.right).to.be.at.most(width);});}
   cy.viewport(390,844);cy.screenshot('profile-privacy-'+theme,{capture:'viewport',overwrite:true});
  }
  cy.contains('button','Ukryj udostępnione imię').click();cy.get('ion-alert:visible').then(el=>{const dismissed=new Cypress.Promise(resolve=>el[0].addEventListener('ionAlertDidDismiss',resolve,{once:true}));cy.wrap(el).contains('button','Anuluj').click();cy.then(()=>dismissed);});cy.contains('button','Ukryj udostępnione imię').should('be.visible');
  cy.contains('button','Ukryj udostępnione imię').click();cy.get('ion-alert:visible').contains('button','Akceptuję').click();cy.get('.slm-group-hide-first').should('not.exist');
  cy.contains('nav button','Profil').click();cy.contains('.slm-ultimate-card','Browser').should('be.visible');cy.contains('button','Edytuj profil').click();cy.get('.slm-premium-identity select').should('have.value','nickname');
 });
});
