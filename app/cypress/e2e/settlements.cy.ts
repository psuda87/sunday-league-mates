describe('Rozliczenia — przygotowany interfejs z kontrolowanym API', () => {
  const input = (label: string, value: string) => cy.get('ion-input').filter((_, el) =>
    (el as unknown as { label: string }).label === label).find('input').clear({log:false}).type(value,{log:false});
  const session = (role: 'member' | 'admin') => ({ user_id: crypto.randomUUID(), access_token: crypto.randomUUID(),
    refresh_token: crypto.randomUUID(), role, must_change_password: false, expires_in: 3600 });
  const profile = (user_id: string) => ({ user_id, login: 'Fixture', phone: '+12025550150', full_name: '', display_as: 'nickname', display_name: 'Fixture' });
  const login = () => { cy.visit('/'); input('E-mail lub login', 'Fixture'); input('Hasło', crypto.randomUUID()); cy.contains('ion-button', 'Zaloguj się').click(); };

  it('pokazuje własny dług/gościa i blokadę; zgłoszenie wpłaty nie zmienia salda', () => {
    const s = session('member'), event = crypto.randomUUID();
    const account = { user_id: s.user_id, balance_cents: -5400, unpaid_matches: 2, blocked: true,
      dues: [{ event_id: event, starts_at: '2026-10-08T17:30:00Z', due_cents: 2700, covered_cents: 0, outstanding_cents: 2700 },
        { event_id: crypto.randomUUID(), starts_at: '2026-10-11T17:30:00Z', due_cents: 2700, covered_cents: 0, outstanding_cents: 2700 }],
      history: [{ id: 1, event_id: event, participant_id: crypto.randomUUID(), amount_cents: -2700, kind: 'charge',
        reason: 'Zatwierdzenie fixture', actor_name: 'Admin fixture', participant_name: 'Gość fixture', is_guest: true,
        starts_at: '2026-10-08T17:30:00Z', created_at: '2026-10-08T19:01:00Z' }], payments: [] as unknown[], decisions: [] };
    cy.intercept('POST', '**/functions/v1/accounts', req => {
      if (req.body.action === 'matches_list') req.reply({events:[],server_now:'2026-10-19T12:00:00Z'});
      else if ((req.body.action === 'groups_list'||req.body.action === 'finance_groups')) req.reply({groups:[]});
      else if (req.body.action === 'events_list') req.reply({ events: [], server_now: '2026-10-17T12:00:00Z' });
      else if (req.body.action === 'login') req.reply(s);
      else if (req.body.action === 'profile') req.reply(profile(s.user_id));
      else if (req.body.action === 'settlements_account') req.reply(account);
      else if (req.body.action === 'settlements_submit_payment') {
        expect(req.body.amount_cents).to.eq(2700); expect(req.body.request_id).to.match(/^[0-9a-f-]{36}$/);
        account.payments.push({ id: req.body.request_id, user_id: s.user_id, amount_cents: 2700, corrected_amount_cents: 2700,
          status: 'pending', note: req.body.reason, created_at: '2026-10-14T17:00:00Z' });
        req.reply({ payment_id: req.body.request_id, status: 'pending' });
      } else req.reply({ ok: true });
    });
    login(); cy.contains('ion-button', 'Rozliczenia').click(); cy.contains('ion-button','Rozliczenia historyczne').click();
    cy.contains('Zapisy i dodawanie gości zablokowane').should('be.visible');
    cy.contains('Gość: Gość fixture').should('be.visible');
    cy.contains('.slm-balance', '-54,00').should('be.visible');
    input('Kwota (zł)', '27,00'); cy.contains('ion-button', 'Zgłoś do zatwierdzenia').click();
    cy.contains('Oczekuje na zatwierdzenie').should('be.visible');
    cy.contains('.slm-balance', '-54,00').should('be.visible');
    cy.contains('Wpłaty oczekujące na decyzję').should('not.exist');
    cy.get('ion-input').filter((_, el) => (el as unknown as { label: string }).label === 'Kwota (zł)').find('input').should('have.value', '');
  });

  it('zatwierdza mecz z wersją i UUID, a po odświeżeniu pokazuje rewizję bez ponownego zatwierdzenia', () => {
    const s = session('admin'), eid = crypto.randomUUID(), pid = crypto.randomUUID();
    let approved = false, approvals = 0;
    const match = () => ({ id: eid, starts_at: '2026-10-08T17:30:00Z', location: 'Boisko fixture', duration_minutes: 90,
      hourly_rate: 180, total_cost: 270, capacity: 10, status: 'scheduled', registered_count: 1, reserve_count: 0,
      registration_open: false, decision_required: false, estimated_per_person: null, settlements_active: true,
      settlement_version: approved ? 2 : 1 });
    cy.intercept('POST', '**/functions/v1/accounts', req => {
      if (req.body.action === 'login') req.reply(s);
      else if (req.body.action === 'profile') req.reply(profile(s.user_id));
      else if (req.body.action === 'matches_list') req.reply({events:[],server_now:'2026-10-19T12:00:00Z'});
      else if ((req.body.action === 'groups_list'||req.body.action === 'finance_groups')) req.reply({groups:[]});
      else if (req.body.action === 'events_list') req.reply({ events: [match()], server_now: '2026-10-14T17:00:00Z' });
      else if (req.body.action === 'events_detail') req.reply({ event: match(), participants: [], server_now: '2026-10-14T17:00:00Z' });
      else if (req.body.action === 'settlements_account') req.reply({ blocked: false, unpaid_matches: 0 });
      else if (req.body.action === 'settlements_detail') req.reply({ event_id: eid, starts_at: match().starts_at, timezone: 'Europe/Warsaw',
        cost_cents: 27000, status: 'scheduled', version: approved ? 2 : 1, revision: approved ? 1 : 0,
        approved_at: approved ? '2026-10-14T17:00:00Z' : null, can_approve: true,
        participants: [{ participant_id: pid, responsible_user_id: s.user_id, name: 'Fixture', status: 'registered', absent: false,
          payable: true, charge_override: null, replacement_id: null, amount_cents: 27000 }], revisions: [], audit: [] });
      else if (req.body.action === 'settlements_approve') {
        expect(req.body.expected_version).to.eq(1); expect(req.body.reason).to.eq('Odbiór fixture');
        expect(req.body.request_id).to.match(/^[0-9a-f-]{36}$/);
        approvals++; approved = true; req.reply({ event_id: eid, version: 2 });
      } else req.reply({ ok: true });
    });
    login(); cy.contains('ion-button', 'Mecze').click(); cy.contains('ion-button', 'Wydarzenia i rozliczenia historyczne').click(); cy.contains('button', 'Historia').click(); cy.get('button[aria-label^="Otwórz szczegóły meczu"]').first().click(); cy.contains('[role=tab]', 'Rozliczenie').click();
    cy.contains('Wstępne — nie tworzy zaległości ani blokady').should('be.visible');
    input('Powód decyzji / korekty', 'Odbiór fixture');
    cy.on('window:confirm', () => true); cy.contains('ion-button', 'Zatwierdź rozliczenie').click();
    cy.contains('Zatwierdzone · rewizja 1').should('be.visible');
    cy.contains('ion-button', 'Zatwierdź rozliczenie').should('not.exist');
    cy.then(() => expect(approvals).to.eq(1));
  });
});
