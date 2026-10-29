let fixture:Record<string,string>;
before(()=>cy.env(['group_id','event_id','public_id','own_past_id'],{log:false}).then(v=>{fixture=v as Record<string,string>;}));
function login(who:'member'|'former'){
 cy.visit('/');cy.env([who+'_email',who+'_password'],{log:false}).then(v=>{cy.get('input[autocomplete="username"]').type(String(v[who+'_email']),{log:false});cy.get('input[type="password"]').type(String(v[who+'_password']),{log:false});cy.get('form').submit();});
 cy.get('select[aria-label="Aktywna grupa"]',{timeout:15000}).should('be.visible');
}
function scroll(top:number){cy.get('ion-content').filter(':visible').last().then($c=>($c[0] as HTMLIonContentElement).getScrollElement().then(e=>{e.scrollTop=top;}));}
describe('Restored Premium behavior with genuine local HTTP',()=>{
 it('member sees permitted events, filters public/group/mine and receives original create form',()=>{
  login('member');cy.get('button.slm-demo-create').should('be.visible');
  cy.get('select[aria-label="Aktywna grupa"]').select('public');cy.get('[data-event="'+fixture.public_id+'"]').should('exist');cy.get('[data-event="'+fixture.event_id+'"]').should('not.exist');
  cy.get('select[aria-label="Aktywna grupa"]').select('mine');cy.get('[data-event]').should('not.exist');
  cy.get('select[aria-label="Aktywna grupa"]').select(fixture.group_id);cy.get('[data-event="'+fixture.event_id+'"]').should('exist');
  for(const width of [320,360,390])for(const dark of [false,true]){
   cy.viewport(width,760);cy.document().then(d=>{d.documentElement.classList.toggle('ion-palette-dark',dark);d.documentElement.style.setProperty('--ion-safe-area-top','24px');});
   cy.get('.slm-compact-header .slm-floating-crest').then($e=>{const r=$e[0].getBoundingClientRect();expect(r.left).to.be.at.least(0);expect(r.right).to.be.at.most(width+1);});
   cy.get('.slm-events-controls').then($e=>expect($e[0].scrollWidth).to.be.at.most(width));
   cy.screenshot('filters-'+width+'-'+(dark?'dark':'light'),{capture:'viewport',overwrite:true});
  }
  cy.get('button.slm-demo-create').click();cy.get('.slm-event-form').should('be.visible');cy.get('.slm-event-form select').first().should('have.value',fixture.group_id);
 });
 it('point-and-swap supports odd roster/guest, undo, sticky actions and no fake save/author',()=>{
  login('member');cy.get('select[aria-label="Aktywna grupa"]').select(fixture.group_id);cy.get('[data-event="'+fixture.event_id+'"] .slm-card-link').click();cy.contains('[role="tab"]','Składy').click();
  cy.contains('button','Utwórz lokalny podgląd').click();cy.get('.slm-team-a .slm-pitch-player').should('have.length',2);cy.get('.slm-team-b .slm-pitch-player').should('have.length',1);
  cy.contains('button','Zamień zawodników').click();cy.get('.slm-team-a .slm-pitch-player').first().click();cy.get('.slm-team-b .slm-pitch-player').first().click();cy.contains('Zamieniono wyłącznie w lokalnym podglądzie.').should('be.visible');
  cy.contains('button','Zakończ zamiany').click();
  for(const width of [320,360,390])for(const dark of [false,true]){cy.viewport(width,760);cy.document().then(d=>d.documentElement.classList.toggle('ion-palette-dark',dark));scroll(600);cy.get('.slm-football-pitch').then($p=>expect($p[0].scrollWidth).to.be.at.most(width));}
  scroll(600);cy.get('.slm-scroll-header[data-stuck=true]').should('be.visible').then($h=>{const r=$h[0].getBoundingClientRect();expect(r.top).to.be.at.least(-1);expect(r.top).to.be.lessThan(30);expect($h.find('img')).to.have.length(0);});
  cy.screenshot('pitch-sticky-dark',{capture:'viewport',overwrite:true});
  cy.contains('button','Przywróć skład').click();cy.get('.slm-team-a .slm-pitch-player').should('have.length',2);cy.get('.slm-team-b .slm-pitch-player').should('have.length',1);cy.contains('Brak zmian względem składu początkowego.').should('exist');cy.contains('Ostatnia zmiana: brak zapisanego składu na serwerze.').should('exist');cy.contains('button',/^Zapisz$/).should('be.disabled');
 });
 it('former member history retains own match and excludes unrelated former-group events',()=>{
  login('former');cy.contains('button','Historia').click();cy.get('[data-event]').should('have.length',1).and('have.attr','data-event',fixture.own_past_id);
  cy.get('.slm-card-link').click();cy.contains('[role="tab"]','Uczestnicy').should('exist');cy.contains('[role="tab"]','Składy').click();cy.contains('Składy niedostępne bez pełnego dostępu do meczu.').should('be.visible');
 });
});
