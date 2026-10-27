describe('real email callback, no session or token persistence',()=>{
 it('opens delivered link, removes bearer URL and performs scoped action',()=>{
  cy.env(['slm_email_link','slm_email_kind','slm_email_password'],{log:false}).then(values=>{
  const link=values.slm_email_link as string,kind=values.slm_email_kind as string,pw=values.slm_email_password as string;
  cy.visit(link,{log:false});cy.location('hash').should('eq','');cy.location('search').should('eq','');
  if(kind==='recovery'||kind==='expired'){
   cy.get('input[autocomplete="new-password"]').first().type(pw,{log:false});cy.get('input[autocomplete="new-password"]').last().type(pw,{log:false});
   cy.contains('button','Zapisz nowe hasło').click();
   cy.contains(kind==='expired'?'Link jest wykorzystany':'Hasło zostało zmienione').should('be.visible');
  }else{cy.contains('button','Potwierdź adres').click();cy.contains('Adres e-mail został potwierdzony').should('be.visible');}
  cy.window().then(w=>{expect(w.localStorage.getItem('slm.refresh')).to.equal(null);expect(w.location.hash).to.equal('');});
  });
 });
});
