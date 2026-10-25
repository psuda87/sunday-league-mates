describe('BottomNav: actual CSS, tab selection and action clearance', () => {
  for (const width of [320, 360, 390, 430]) for (const theme of ['light', 'dark']) {
    it(`${width}px / ${theme}: all tab highlights fill their slots`, () => {
      cy.viewport(width, 844);
      cy.visit('/cypress/fixtures/bottom-nav.html');
      cy.document().then(doc => {
        doc.documentElement.dataset.theme = 'espana';
        doc.documentElement.classList.toggle('ion-palette-dark', theme === 'dark');
      });
      for (const variant of ['live', 'premium', 'admin']) {
        cy.get(`section[aria-label="${variant}"]`).within(() => {
          for (const label of ['Mecze', 'Grupy', 'Profil']) {
            cy.contains('nav button', label).click();
            cy.get('button[aria-current="page"]').should('have.length', 1).and('contain', label).then($button => {
              const button = $button[0], nav = button.closest('nav')!;
              const win = button.ownerDocument.defaultView!;
              const style = win.getComputedStyle(button), navStyle = win.getComputedStyle(nav);
              const box = button.getBoundingClientRect(), bar = nav.getBoundingClientRect();
              expect(style.backgroundImage, `${variant}/${label} active fill`).to.include('linear-gradient');
              expect(style.borderTopColor, `${variant}/${label} visible border`).not.eq('rgba(0, 0, 0, 0)');
              expect(box.top - bar.top, 'highlight starts at standard top inset').closeTo(5 + parseFloat(navStyle.borderTopWidth), 1);
              expect(box.height, 'full available bar height').closeTo(bar.height - parseFloat(navStyle.paddingTop) - parseFloat(navStyle.paddingBottom) - parseFloat(navStyle.borderTopWidth), 1);
              expect(box.width, 'one complete tab slot').closeTo((bar.width - parseFloat(navStyle.paddingLeft) - parseFloat(navStyle.paddingRight)) / 3, 1);
              expect(box.height, 'same overall bar/content geometry').closeTo(variant === 'admin' ? 75 : 56, 1);
              if (variant === 'admin' && label === 'Grupy') {
                expect(style.maskImage, 'highlight respects the existing plus notch').to.include('radial-gradient');
                const plus = nav.querySelector('.slm-demo-create')!.getBoundingClientRect();
                const icon = button.querySelector('ion-icon')!.getBoundingClientRect();
                expect(icon.top, 'group icon stays below plus').to.be.greaterThan(plus.bottom);
              }
            });
          }
          if (variant === 'admin') {
            cy.get('button[aria-label="Utwórz mecz"]').click();
            cy.get('output').should('have.text', '1');
            cy.get('button[aria-current="page"]').should('contain', 'Profil');
          }
        });
      }
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
      if (width === 390) {
        for (const variant of ['live', 'premium', 'admin']) cy.contains(`section[aria-label="${variant}"] nav button`, 'Grupy').click();
        cy.screenshot(`bottom-nav-${theme}`, { capture: 'viewport', overwrite: true });
      }
    });
  }
});
