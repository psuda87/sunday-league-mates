describe('Wydarzenia — interfejs z kontrolowanym API', () => {
  const input = (label: string, value: string) => cy.get('ion-input').filter((_, el) => (el as unknown as { label: string }).label === label)
    .find('input').clear({ log: false }).type(value, { log: false });
  const session = () => ({ access_token: crypto.randomUUID(), refresh_token: crypto.randomUUID(), expires_in: 3600,
    user_id: crypto.randomUUID(), role: 'admin', must_change_password: false });
  it('administrator podaje godzinę i limit; formularz zawiera tylko zatwierdzone wartości domyślne', () => {
    const s = session();
    cy.intercept('POST', '**/functions/v1/accounts', req => {
      if (req.body.action === 'login') req.reply(s);
      else if (req.body.action === 'profile') req.reply({ user_id: s.user_id, login: 'Fixture', phone: '+12025550150', full_name: '', display_as: 'nickname', display_name: 'Fixture' });
      else if (req.body.action === 'events_list') req.reply({ events: [], server_now: '2026-10-14T22:30:00Z' });
      else req.reply({ ok: true });
    });
    cy.visit('/'); input('Login lub numer telefonu', 'Fixture'); input('Hasło', crypto.randomUUID()); cy.contains('ion-button', 'Zaloguj się').click();
    cy.contains('ion-button', 'Mecze').click(); cy.contains('ion-button', 'Utwórz mecz').click();
    cy.get('input[type=time]').should('have.value', '');
    cy.get('ion-input').filter((_, el) => (el as unknown as { label: string }).label === 'Maksymalna liczba miejsc').find('input').should('have.value', '');
    cy.get('ion-input').filter((_, el) => (el as unknown as { label: string }).label === 'Czas gry (minuty)').find('input').should('have.value', '90');
    cy.get('ion-input').filter((_, el) => (el as unknown as { label: string }).label === 'Koszt całkowity (zł)').find('input').should('have.value', '270');
    cy.contains('ion-button', 'Najbliższy czwartek').click(); cy.get('input[type=date]').should('have.value', '2026-10-15');
  });
  it('pokazuje rezerwę, szacunek kosztu i kontakt gościa do zapraszającego', () => {
    const s = { ...session(), role: 'member' }, eid = crypto.randomUUID();
    const event = { id: eid, starts_at: '2099-10-15T17:30:00Z', location: 'Fikcyjne boisko', duration_minutes: 90,
      hourly_rate: 180, total_cost: 270, capacity: 10, status: 'scheduled', registered_count: 1, reserve_count: 1,
      registration_open: true, decision_required: false, estimated_per_person: 270, settlements_active: false };
    const guest = { id: crypto.randomUUID(), member_id: null, responsible_user_id: s.user_id, display_name: 'Gość testowy',
      guest_name: 'Gość testowy', guest_phone: null, contact_phone: '+12025550150', responsible_name: 'Fixture', status: 'registered', absent: false };
    cy.intercept('POST', '**/functions/v1/accounts', req => {
      if (req.body.action === 'login') req.reply(s);
      else if (req.body.action === 'profile') req.reply({ user_id: s.user_id, login: 'Fixture', phone: '+12025550150', full_name: '', display_as: 'nickname', display_name: 'Fixture' });
      else if (req.body.action === 'events_list') req.reply({ events: [event], server_now: '2099-10-15T14:00:00Z' });
      else if (req.body.action === 'events_detail') req.reply({ event, participants: [guest, { ...guest, id: crypto.randomUUID(), display_name: 'Rezerwowy', status: 'reserve' }], server_now: '2099-10-15T14:00:00Z' });
      else if (req.body.action === 'events_join') req.reply({ statusCode: 409, body: { code: 'event_full', error: 'Brak wolnych miejsc. Możesz dołączyć do rezerwy.' } });
      else req.reply({ ok: true });
    });
    cy.visit('/'); input('Login lub numer telefonu', 'Fixture'); input('Hasło', crypto.randomUUID()); cy.contains('ion-button', 'Zaloguj się').click();
    cy.contains('ion-button', 'Mecze').click(); cy.contains('ion-button', 'Szczegóły').click();
    cy.contains('Rozliczenia nie są jeszcze aktywne.').should('be.visible'); cy.contains('Bez automatycznego awansu').should('be.visible');
    cy.get('a[href="tel:+12025550150"]').first().should('contain', 'Zadzwoń do zapraszającego');
    cy.contains('ion-button', 'Utwórz mecz').should('not.exist');
    cy.contains('ion-button', 'Zapisz się').click(); cy.get('[role=alert]').should('contain', 'Brak wolnych miejsc');
  });
});
