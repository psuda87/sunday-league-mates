describe('Premium profile labels: real CSS and Ionic scroll container',()=>{
 for(const width of [320,360,390])for(const theme of ['light','dark']){
  it(`${width}px ${theme}: separate labels, focus and reduced viewport`,()=>{
   cy.viewport(width,844);cy.visit('/cypress/fixtures/profile-layout.html');
   cy.document().then(doc=>doc.documentElement.classList.toggle('ion-palette-dark',theme==='dark'));
   cy.contains('button','Edytuj profil').click();
   for(const height of [844,380]){
    cy.viewport(width,height);
    cy.get('.slm-premium-identity > label').should('have.length',5).each($label=>{
     const label=$label[0],input=label.querySelector('input,select') as HTMLElement;
     const text=label.ownerDocument.createRange();text.selectNode(label.firstChild!);
     cy.wrap(input).then(()=>{input.focus();input.scrollIntoView({block:'center'});});
     cy.wrap(input).should(()=>{
      const box=input.getBoundingClientRect(),caption=text.getBoundingClientRect();
      expect(box.top-caption.bottom,'gap below caption').to.be.at.least(6);
      expect(box.left,'left edge').to.be.at.least(0);expect(box.right,'right edge').to.be.at.most(width);
      const footer=label.ownerDocument.querySelector('ion-footer')!.getBoundingClientRect();
      expect(box.top,'focused field above viewport top').to.be.at.least(0);
      expect(box.bottom,'focused field above footer').to.be.at.most(footer.top+1);
      expect(label.ownerDocument.activeElement).to.equal(input);
     });
    });
   }
   if(width===390){cy.viewport(width,844);cy.get('.slm-premium-identity').then(el=>el[0].scrollIntoView({block:'start'}));cy.screenshot('profile-labels-'+theme,{capture:'viewport',overwrite:true});}
  });
 }
});
