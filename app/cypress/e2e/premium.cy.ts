import { openProfile } from '../support/navigation';

describe('Premium 3.18 — układ na telefonie', () => {
  for (const width of [320, 390, 768]) {
    it(`profil, grupy i plus organizatora przy szerokości ${width}`, () => {
      const session = { user_id:crypto.randomUUID(), access_token:crypto.randomUUID(), refresh_token:crypto.randomUUID(), role:'member', must_change_password:false, expires_in:3600 };
      const group = { id:crypto.randomUUID(), name:'Grupa testowa UI', description:'Kontrolowany test przeglądarkowy', admin_id:session.user_id, organizer:true };
      cy.viewport(width, 844);
      cy.intercept('POST', '**/functions/v1/accounts', req => {
        const action = req.body.action;
        if (action === 'login') req.reply(session);
        else if (action === 'profile') req.reply({ user_id:session.user_id, login:'Test UI', phone:'', full_name:'', display_as:'nickname', display_name:'Test UI', email_account:true });
        else if (action === 'groups_list') req.reply({ groups:[group] });
        else if (action === 'groups_inbox') req.reply({ requests:[] });
        else if (action === 'matches_list') req.reply({ events:[], server_now:'2026-10-23T12:00:00Z' });
        else req.reply({ ok:true });
      });
      cy.visit('/');
      cy.get('ion-input').filter((_, el) => (el as unknown as {label:string}).label === 'E-mail, login lub numer telefonu').find('input').type('test@fixture.invalid');
      cy.get('input[type="password"]').type(crypto.randomUUID(), { log:false });
      cy.contains('ion-button','Zaloguj się').click();
      openProfile();
      cy.get('.slm-ultimate-card').should('be.visible');
      cy.get('[data-portrait="initials"]').should('be.visible');
      cy.get('.slm-ultimate-stats dd').each(el => expect(el.text()).to.equal('—'));
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
      if (width === 390) cy.screenshot('premium318-live-profile', { capture:'viewport' });
      cy.contains('nav.slm-bottom-nav button','Grupy').click();
      cy.contains('button','Grupa testowa UI').should('be.visible');
      if (width === 390) cy.screenshot('premium318-live-groups', { capture:'viewport' });
      cy.get('button[aria-label="Utwórz mecz"]').click();
      cy.contains('h1','Formularz meczu').should('be.visible');
      cy.get('input[placeholder="DD.MM.RRRR"]').should('have.value','');
      cy.get('input[placeholder="HH:mm"]').should('have.value','');
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
      if (width === 390) cy.screenshot('premium318-live-event-form', { capture:'viewport' });
    });
  }
});
