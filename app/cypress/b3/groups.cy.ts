// Real localhost HTTP, Supabase Auth and PostgreSQL. Only newly created fixtures.
describe('Premium B3: original groups UI with real backend',()=>{
 it('logs in, creates/searches a group, retains it after reload and preserves account/profile navigation',()=>{
  const groupName='B3 Browser '+Date.now();
  cy.viewport(390,844);
  cy.intercept('**/functions/v1/accounts*',req=>{if(!req.url.startsWith('http://127.0.0.1:54321/'))throw Error('Remote backend forbidden');req.continue();});
  cy.visit('/',{onBeforeLoad:win=>win.localStorage.clear()});
  cy.env(['slm_email','slm_password'],{log:false}).then(values=>{cy.get('#account-email').type(String(values.slm_email),{log:false});cy.get('input[autocomplete="current-password"]').type(String(values.slm_password),{log:false});});
  cy.contains('button','Zaloguj').click();cy.get('.slm-demo-nav').should('be.visible');
  cy.contains('nav button','Grupy').click();cy.contains('Grupy i członkostwo: Supabase').should('be.visible');
  cy.contains('button','Utwórz grupę').click();cy.get('#group-name').type(groupName);cy.get('#group-description').type('Fictional local group');cy.get('form[aria-label="Utwórz grupę"] button[type=submit]').click();
  cy.contains('.slm-group-hero',groupName).should('be.visible');cy.contains('.slm-group-role','Administrator').should('be.visible');
  cy.get('[role=switch]').should('have.attr','aria-checked','false').click();cy.get('[role=switch]').should('have.attr','aria-checked','true').and('not.be.disabled');
  cy.get('[aria-label="Odśwież grupy"]').click();cy.get('[role=switch]').should('have.attr','aria-checked','true').and('not.be.disabled');
  cy.contains('.slm-group-person','B3 Player 1').click();cy.get('.slm-ultimate-card').should('be.visible');cy.contains('a','Zadzwoń').should('have.attr','href').and('match',/^tel:\+48000/);
  cy.get('[aria-label="Wróć do grupy"]').click();cy.contains('.slm-group-hero',groupName).should('be.visible');
  cy.contains('.slm-group-person','B3 Player 1').click();cy.get('.slm-ultimate-card').should('be.visible');
  cy.contains('nav button','Grupy').click();cy.contains('h1','Moje grupy').should('be.visible');cy.contains('.slm-group-card',groupName).click();
  cy.reload();cy.contains('.slm-group-hero',groupName,{timeout:15000}).should('be.visible');cy.get('[role=switch]').should('have.attr','aria-checked','true');cy.get('[aria-label="Wróć do moich grup"]').click();cy.contains('button','Znajdź grupę').click();cy.get('#group-query').type(groupName);cy.contains('.slm-group-card',groupName).should('be.visible');
  cy.contains('button','Otwórz swoją grupę').click();cy.contains('.slm-group-hero',groupName).should('be.visible');
  for(const theme of ['light','dark']){
   cy.document().then(doc=>doc.documentElement.classList.toggle('ion-palette-dark',theme==='dark'));
   for(const width of [320,360,390,430]){cy.viewport(width,844);cy.document().then(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(width));for(const selector of ['[role=switch]','.slm-group-refresh'])cy.get(selector).then(el=>{const r=el[0].getBoundingClientRect();expect(r.width).to.be.at.least(44);expect(r.height).to.be.at.least(44);expect(r.right).to.be.at.most(width);});}
   cy.viewport(390,844);
   cy.screenshot('groups-real-'+theme,{capture:'viewport',overwrite:true});
  }
  cy.contains('nav button','Profil').click();cy.contains('Profil Supabase').should('be.visible');cy.get('.slm-ultimate-card').should('be.visible');
  cy.contains('nav button','Mecze').click();cy.contains('Dane przykładowe').should('be.visible');
 });
});
