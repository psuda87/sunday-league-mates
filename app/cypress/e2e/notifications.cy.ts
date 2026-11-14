describe('Centrum powiadomień z kontrolowanym API (przygotowane)', () => {
  it('działa bez Firebase, pokazuje licznik i otwiera mecz z własnego rekordu', () => {
    const id = crypto.randomUUID(), eventId = crypto.randomUUID();
    const session = { user_id: crypto.randomUUID(),access_token: crypto.randomUUID(),refresh_token: crypto.randomUUID(),
      role: 'member',must_change_password: false,expires_in: 3600 };
    let read = false;
    const item = () => ({ id,event_id: eventId,category: 'new_match',kind: 'new_match',title: 'Nowy mecz',body: 'Sprawdź termin.',
      created_at: '2026-10-14T12:00:00Z',read_at: read ? '2026-10-14T12:01:00Z' : null });
    const event = { id: eventId,starts_at: '2099-10-15T17:30:00Z',location: 'Boisko fixture',duration_minutes: 90,hourly_rate: 180,
      total_cost: 270,capacity: 10,status: 'scheduled',registered_count: 0,reserve_count: 0,registration_open: true,
      decision_required: false,estimated_per_person: null,settlements_active: false };
    cy.intercept('POST','**/functions/v1/accounts',req => {
      if (req.body.action==='login') req.reply(session);
      else if (req.body.action==='profile') req.reply({ ...session,login: 'Fixture',display_name: 'Fixture',phone: '+12025550111',full_name: '',display_as: 'nickname' });
      else if (req.body.action==='notifications_count') req.reply({ unread: read ? 0 : 1 });
      else if (req.body.action==='notifications_list') req.reply({ notifications: [item()],unread: read ? 0 : 1,
        preferences: { new_match: true,vacancy: true,reminder: true,match_changed: true,finance: true } });
      else if (req.body.action==='notifications_open') { expect(req.body.notification_id).to.eq(id); read=true; req.reply({ body: item() }); }
      else if (req.body.action==='matches_list') req.reply({events:[],server_now:'2026-10-19T12:00:00Z'});
      else if ((req.body.action==='groups_list'||req.body.action==='finance_groups')) req.reply({groups:[]});
      else if (req.body.action==='events_list') req.reply({ events: [event],server_now: '2026-10-14T12:00:00Z' });
      else if (req.body.action==='events_detail') req.reply({ event,participants: [],server_now: '2026-10-14T12:00:00Z' });
      else req.reply({ ok: true });
    });
    const input = (label: string,value: string) => cy.get('ion-input').filter((_,el) => (el as unknown as { label: string }).label===label).find('input').type(value, {log:false});
    cy.visit('/'); input('E-mail lub login','Fixture'); input('Hasło',crypto.randomUUID()); cy.contains('ion-button','Zaloguj się').click();
    cy.contains('ion-button','Powiadomienia (1)').click(); cy.contains('Centrum powiadomień').should('be.visible');
    cy.contains('Historia i licznik w aplikacji działają niezależnie').should('be.visible');
    cy.contains('ion-button','Otwórz mecz').click(); cy.contains('Boisko fixture').should('be.visible');
    cy.contains('ion-button','Powiadomienia (1)').should('not.exist');
  });
});
