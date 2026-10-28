// Actual local accounts/DTOs. No mocked responses or mutations of business records.
let mode='after';
function login(who:'admin'|'player'){
 cy.visit('http://127.0.0.1:5186');
 cy.env([who+'_email',who+'_password','mode'],{log:false}).then(v=>{mode=String(v.mode);cy.get('input[autocomplete="username"]').type(String(v[who+'_email']),{log:false});cy.get('input[type="password"]').type(String(v[who+'_password']),{log:false});cy.get('form').submit();});
 cy.get('select[aria-label="Aktywna grupa"]',{timeout:20000}).should('be.visible');
}
function layout(){
 cy.get('.slm-events-controls').then($e=>{const r=$e[0].getBoundingClientRect();expect(r.right).to.be.at.most($e[0].ownerDocument.defaultView!.innerWidth+1);});
 cy.get('.slm-events-controls label').then($label=>cy.get('.slm-events-controls ion-button').then($button=>expect($label[0].getBoundingClientRect().bottom).to.be.at.most($button[0].getBoundingClientRect().top)));
 cy.get('.slm-match-list').then($list=>expect($list[0].scrollWidth).to.be.at.most($list[0].ownerDocument.defaultView!.innerWidth));
 cy.get('.slm-compact-header h1').then($h=>expect($h[0].getBoundingClientRect().top).to.be.at.least(24));
 cy.get('.slm-demo-nav').then($nav=>{const r=$nav[0].getBoundingClientRect();expect(r.bottom).to.be.at.most($nav[0].ownerDocument.defaultView!.innerHeight+1);expect(r.top).to.be.greaterThan(0);});
 cy.get('.slm-match-compact .slm-hero-card').each($card=>{const r=$card[0].getBoundingClientRect();expect(r.height).to.be.lessThan(220);expect(r.width).to.be.greaterThan(230);});
}
describe('Premium visual restore, local real Supabase',()=>{
 it('captures the original Premium demo reference',()=>{cy.visit('http://127.0.0.1:5190');cy.viewport(390,844);cy.get('.slm-match-compact',{timeout:20000}).should('exist');cy.screenshot('original-premium-dark',{capture:'viewport',overwrite:true});});
 it('player list, details, finance and local pitch use genuine DTOs',()=>{
  login('player');cy.viewport(390,844);cy.then(()=>cy.screenshot(mode+'-list-dark',{capture:'viewport',overwrite:true}));
  cy.then(()=>{if(mode==='before')return;for(const width of [320,360,390])for(const dark of [false,true]){
   cy.viewport(width,760);cy.document().then(doc=>{doc.documentElement.classList.toggle('ion-palette-dark',dark);doc.documentElement.style.setProperty('--ion-safe-area-top','24px');});
   layout();cy.screenshot('after-list-'+width+'-'+(dark?'dark':'light'),{capture:'viewport',overwrite:true});
  }});
  cy.get('select[aria-label="Aktywna grupa"]').find('option').contains('Finance Browser 2ddfdc1f').then($o=>cy.get('select[aria-label="Aktywna grupa"]').select(String($o.val())));
  cy.contains('button','Historia').click();cy.get('.slm-card-link').first().click();cy.get('[role="tab"]').should('have.length',4);cy.then(()=>cy.screenshot(mode+'-details-dark',{capture:'viewport',overwrite:true}));cy.contains('[role="tab"]','Składy').click();
  cy.then(()=>{if(mode==='before'){cy.screenshot('before-pitch-placeholder',{capture:'viewport',overwrite:true});return;}
   cy.contains('Lokalny podgląd · bez zapisu na serwerze').should('be.visible');
   cy.get('.slm-lineup-roster select').first().select('a');cy.get('.slm-lineup-roster select').eq(1).select('b');
   cy.contains('button','Zamień zawodników').click();
   cy.get('.slm-team-a .slm-pitch-player').first().click();cy.get('.slm-team-b .slm-pitch-player').first().click();cy.contains('Zamieniono wyłącznie w lokalnym podglądzie.').should('be.visible');
   for(const width of [320,360,390])for(const dark of [false,true]){cy.viewport(width,760);cy.document().then(doc=>doc.documentElement.classList.toggle('ion-palette-dark',dark));cy.get('.slm-football-pitch').scrollIntoView();cy.get('.slm-football-pitch').then($p=>expect($p[0].scrollWidth).to.be.at.most(width));}
   cy.viewport(390,844);cy.get('.slm-football-pitch').scrollIntoView();cy.screenshot('after-pitch-dark',{capture:'viewport',overwrite:true});
  });
  cy.contains('[role="tab"]','Rozliczenie').click();cy.get('.slm-premium-finance',{timeout:15000}).should('contain','Należność');
 });
 it('administrator retains original plus and the real form',()=>{
  login('admin');cy.get('button.slm-demo-create',{timeout:15000}).should('be.visible').click();cy.get('.slm-event-form').should('be.visible');cy.viewport(320,560);cy.get('.slm-event-form input').first().focus();cy.screenshot(mode+'-admin-create',{capture:'viewport',overwrite:true});
 });
});
