describe('Minimalny moduł kont — UI z kontrolowanym API', () => {
  const input = (label: string, value: string) => cy.get('ion-input').filter((_, el) => (el as unknown as {label: string}).label === label).find('input').clear({ log: false }).type(value, { log: false });
  const submit = (text: string) => cy.contains('ion-button', text).click();
  it('pokazuje odmowę logowania i nie oferuje rejestracji', () => {
    cy.intercept('POST', '**/functions/v1/accounts', {statusCode:401,body:{code:'invalid_credentials',error:'Nieprawidłowy login, numer telefonu lub hasło.'}}).as('denied');
    cy.visit('/'); input('Login lub numer telefonu', 'Fikcyjny'); input('Hasło', crypto.randomUUID()); submit('Zaloguj się');
    cy.wait('@denied'); cy.get('[role="alert"]').should('contain', 'Nieprawidłowy login');
    cy.contains('Zarejestruj się').should('not.exist'); cy.contains('Zarządzaj kontami').should('not.exist');
    cy.get('input[type="password"]').should('have.value', '');
  });
  it('wymusza zmianę hasła, pokazuje profil i wylogowuje przy odrzuceniu sesji', () => {
    const session = {access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,
      user_id:crypto.randomUUID(),role:'member',must_change_password:true};
    let invalid = false;
    cy.intercept('POST', '**/functions/v1/accounts', req => {
      if (req.body.action === 'events_list') req.reply({ events: [], server_now: '2026-10-17T12:00:00Z' });
      else if (req.body.action === 'login') req.reply(session);
      else if (req.body.action === 'password') req.reply({...session,must_change_password:false});
      else if (req.body.action === 'profile') req.reply({user_id:session.user_id,login:'Fikcyjny',phone:'+12025550112',full_name:'',display_as:'nickname',display_name:'Fikcyjny'});
      else if (req.body.action === 'save_profile' && invalid) req.reply({statusCode:401,body:{code:'session_invalid',error:'Sesja wygasła. Zaloguj się ponownie.'}});
      else req.reply({ok:true});
    });
    cy.visit('/'); input('Login lub numer telefonu','Fikcyjny'); const temporary = crypto.randomUUID();
    input('Hasło',temporary); submit('Zaloguj się'); cy.contains('h1','Zmień hasło tymczasowe').should('be.visible');
    cy.contains('Mój profil').should('not.exist'); cy.contains('Zarządzaj kontami').should('not.exist');
    input('Hasło tymczasowe',temporary); const next = crypto.randomUUID(); input('Nowe hasło',next); input('Powtórz nowe hasło',next); submit('Zmień hasło');
    cy.contains('ion-button', 'Mój profil').click(); cy.contains('h1','Fikcyjny').should('be.visible'); cy.get('a[href="tel:+12025550112"]').should('contain','Zadzwoń');
    cy.contains('Zarządzaj kontami').should('not.exist');
    cy.window().then(win => { expect(win.localStorage.length).to.eq(1); invalid = true; });
    submit('Zapisz profil'); cy.contains('h1','Zaloguj się').should('be.visible');
  });
  it('administrator widzi tworzenie kont i akcję resetu', () => {
    const session = {access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,user_id:crypto.randomUUID(),role:'admin',must_change_password:false};
    const player = {user_id:crypto.randomUUID(),login:'Fikcyjny',phone:'+12025550112',full_name:'',display_as:'nickname',display_name:'Fikcyjny',role:'member',must_change_password:true,operation_pending:false};
    cy.intercept('POST','**/functions/v1/accounts',req => {
      if(req.body.action==='events_list') req.reply({ events: [], server_now: '2026-10-17T12:00:00Z' });
      else if(req.body.action==='login') req.reply(session);
      else if(req.body.action==='list_accounts') req.reply([player]);
      else if(req.body.action==='profile') req.reply({...player,user_id:session.user_id});
      else req.reply({ok:true});
    });
    cy.visit('/'); input('Login lub numer telefonu','Fikcyjny'); input('Hasło',crypto.randomUUID()); submit('Zaloguj się');
    submit('Zarządzaj kontami'); cy.contains('h1','Utwórz konto zawodnika').should('be.visible'); cy.contains('Resetuj hasło').should('be.visible');
  });
  it('po ponownym otwarciu sprawdza zapisany refresh; offline ukrywa dane, logout usuwa zapis', () => {
    const key='slm.auth.hjtcyybkxebvdropchac.refresh.v1';
    const result={access_token:crypto.randomUUID(),refresh_token:crypto.randomUUID(),expires_in:3600,user_id:crypto.randomUUID(),role:'member',must_change_password:false};
    let online=true,allowRefresh: (()=>void) | null=null;
    cy.intercept('POST','**/functions/v1/accounts',req=>{
      if(req.body.action==='events_list') req.reply({ events: [], server_now: '2026-10-17T12:00:00Z' });
      else if(req.body.action==='login') req.reply(result);
      else if(req.body.action==='refresh') {
        if(!online) req.destroy();
        else if(allowRefresh===null) req.reply(result);
        else return new Promise<void>(resolve=>{allowRefresh=()=>{req.reply(result);resolve();};});
      }
      else if(req.body.action==='profile') req.reply({user_id:result.user_id,login:'Fikcyjny',phone:'+12025550112',full_name:'',display_as:'nickname',display_name:'Fikcyjny'});
      else req.reply({ok:true});
    });
    cy.visit('/'); input('Login lub numer telefonu','Fikcyjny'); input('Hasło',crypto.randomUUID()); submit('Zaloguj się');
    cy.contains('ion-button', 'Mój profil').click(); cy.contains('h1','Fikcyjny').should('be.visible');
    cy.then(()=>{allowRefresh=()=>undefined;});cy.reload();
    cy.contains('Sprawdzanie sesji').should('be.visible');cy.contains('h1','Fikcyjny').should('not.exist');
    cy.then(()=>{allowRefresh?.();allowRefresh=null;});cy.contains('ion-button', 'Mój profil').click();cy.contains('h1','Fikcyjny').should('be.visible');
    cy.then(()=>{online=false;});cy.reload();cy.contains('h1','Potwierdź dostęp do konta').should('be.visible');
    cy.contains('h1','Fikcyjny').should('not.exist');cy.window().then(win=>expect(win.localStorage.getItem(key)!==null).to.eq(true));
    cy.then(()=>{online=true;});submit('Spróbuj ponownie');cy.contains('ion-button', 'Mój profil').click();cy.contains('h1','Fikcyjny').should('be.visible');
    submit('Wyloguj się');cy.contains('h1','Zaloguj się').should('be.visible');cy.reload();cy.contains('h1','Zaloguj się').should('be.visible');
    cy.window().then(win=>expect(win.localStorage.getItem(key)).to.eq(null));
  });
  it('odrzuca zapisaną sesję po resecie bez pokazania profilu',()=>{
    const key='slm.auth.hjtcyybkxebvdropchac.refresh.v1';
    cy.intercept('POST','**/functions/v1/accounts',{statusCode:401,body:{code:'session_invalid',error:'Sesja cofnięta.'}});
    cy.visit('/',{onBeforeLoad:win=>win.localStorage.setItem(key,crypto.randomUUID())});
    cy.contains('h1','Zaloguj się').should('be.visible');cy.contains('Mój profil').should('not.exist');
    cy.window().then(win=>expect(win.localStorage.getItem(key)).to.eq(null));
  });
});
