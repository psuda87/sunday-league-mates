describe('Guest form and scope control with actual Premium CSS (no backend)',()=>{
 for(const width of [320,360,390])for(const theme of ['light','dark']){
  it(`${width}px ${theme}: captions, touch targets and reduced viewport`,()=>{
   cy.viewport(width,844);cy.visit('/cypress/fixtures/guest-layout.html');
   cy.document().then(doc=>doc.documentElement.classList.toggle('ion-palette-dark',theme==='dark'));
   cy.get('select[aria-label="Aktywna grupa"]').should('have.value','mine').and('be.visible');
   for(const height of [844,380]){
    cy.viewport(width,height);
    cy.get('.slm-guest-form label').should('have.length',3).each($label=>{
     const label=$label[0],input=label.querySelector('input,select') as HTMLElement;
     const caption=label.ownerDocument.createRange();caption.selectNode(label.firstChild!);
     cy.wrap(input).then(()=>{input.focus();input.scrollIntoView({block:'center'});});
     cy.wrap(input).should(()=>{
      const box=input.getBoundingClientRect(),text=caption.getBoundingClientRect();
      expect(box.top-text.bottom,'label gap').to.be.at.least(5);
      expect(box.height,'touch target').to.be.at.least(44);
      expect(box.left,'left edge').to.be.at.least(0);
      expect(box.right,'right edge').to.be.at.most(width);
      expect(box.top,'focused top').to.be.at.least(0);
      expect(box.bottom,'focused bottom').to.be.at.most(height);
     });
    });
   }
   if(width===390){cy.viewport(width,844);cy.get('ion-content').then($el=>($el[0] as HTMLIonContentElement).scrollToTop(0));cy.screenshot('guest-layout-'+theme,{capture:'viewport',overwrite:true});cy.get('.slm-guest-form').screenshot('guest-form-'+theme,{overwrite:true});}
  });
 }
});
