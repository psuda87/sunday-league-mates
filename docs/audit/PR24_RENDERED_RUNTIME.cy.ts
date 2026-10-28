function login(who:'member'|'admin'){
 cy.visit('/');cy.env([who+'_email',who+'_password'],{log:false}).then(v=>{cy.get('input[autocomplete="username"]').type(String(v[who+'_email']),{log:false});cy.get('input[type="password"]').type(String(v[who+'_password']),{log:false});cy.get('form').submit();});
 cy.get('select[aria-label="Aktywna grupa"]',{timeout:15000}).should('be.visible');
}
describe('Independent PR24 rendered runtime audit',()=>{
 it('renders own Ultimate and real member finance in mobile Light/Dark',()=>{
  login('member');cy.get('button[data-tab="profile"]').click();cy.get('.slm-ultimate-card').should('be.visible');
  for(const width of [320,360,390])for(const dark of [false,true]){cy.viewport(width,760);cy.document().then(d=>d.documentElement.classList.toggle('ion-palette-dark',dark));cy.get('.slm-ultimate-card').then($c=>{const r=$c[0].getBoundingClientRect();expect(r.left).to.be.at.least(0);expect(r.right).to.be.at.most(width+1);});}
  cy.screenshot('own-ultimate-dark',{capture:'viewport',overwrite:true});
  cy.get('button[data-tab="events"]').click();cy.contains('ion-button',/moje rozliczenia grupowe/i).click();
  cy.get('[aria-label="Rzeczywiste rozliczenia grupy"]').should('be.visible');cy.contains('Saldo w grupie').should('exist');cy.contains('Zgłoś wpłatę').should('exist');
  cy.screenshot('member-real-finance-dark',{capture:'viewport',overwrite:true});
 });
 it('renders current administrator real group finance without legacy/demo substitution',()=>{
  login('admin');cy.contains('ion-button',/moje rozliczenia grupowe/i).click();cy.get('[aria-label="Rzeczywiste rozliczenia grupy"]').should('be.visible');cy.contains('Saldo w grupie').should('exist');cy.contains('Wpłaty do zatwierdzenia').should('exist');cy.contains('Nie udało się potwierdzić rozliczeń.').should('not.exist');
 });
});
