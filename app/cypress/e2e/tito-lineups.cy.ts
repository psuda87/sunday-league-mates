// Component E2E only; synthetic sessions and shared transport, no SQL/Edge.
describe('Tito mobile UI with two active synthetic sessions',()=>{
 const client=(i:number)=>cy.get(`[data-client="${i}"]`);
 const button=(i:number,label:string)=>client(i).contains('button',new RegExp('^'+label+'$'));
 const choose=(i:number,person:number)=>client(i).find(`button[aria-label="Wybierz do zamiany: Osoba ${person}"]`).click();
 const swap=(i:number)=>{button(i,'Zamień zawodników').click();choose(i,0);choose(i,1);};
 beforeEach(()=>{
  // All data is local RAM. Reject any accidental external request.
  cy.intercept('https://**',{statusCode:503,body:'External network prohibited'});
  cy.viewport(390,844);cy.visit('/.cache/tito-browser/index.html');
  client(0).contains('Ostatnia zmiana: Tito').should('exist');client(1).contains('Ostatnia zmiana: Tito').should('exist');
 });
 it('renders both teams, jersey bounds, withdrawn projection and unchanged mobile layout',()=>{
  client(0).find('.slm-team-a [data-entry$="000000000001"] .slm-pitch-token').should('have.text','0');
  client(0).find('.slm-team-b [data-entry$="000000000002"] .slm-pitch-token').should('have.text','99');
  client(0).find('[data-entry$="000000000003"] .slm-pitch-token').should('have.text','—');
  client(0).find('[data-entry$="000000000010"] .slm-pitch-token').should('have.text','G');
  cy.get('[data-withdrawn]').should('have.length',1).and('contain','Wycofany gość');
  for(const width of [320,390])for(const dark of [true,false]){
   cy.viewport(width,844);cy.document().then(d=>d.documentElement.classList.toggle('ion-palette-dark',dark));
   cy.document().then(d=>expect(d.documentElement.scrollWidth).to.be.at.most(width));
   client(0).find('.slm-pitch-player').each(el=>expect(el[0].getBoundingClientRect().width).to.be.at.least(44));
  }
  cy.screenshot('tito-mobile-390-light',{capture:'viewport'});
 });
 it('refreshes the second session and retains its unsaved conflicting draft',()=>{
  swap(1);swap(0);button(0,'Zapisz').click();client(0).contains('Skład zapisany i odświeżony.').should('exist');
  cy.window().then(w=>w.dispatchEvent(new Event('focus')));
  client(1).contains('Ktoś zapisał nowszy skład').should('exist');
  client(1).find('[data-lineup-dirty]').should('have.attr','data-lineup-dirty','true');button(1,'Zapisz').should('be.disabled');
  button(1,'Odśwież skład').click();button(1,'Zachowaj szkic').click();client(1).find('[data-lineup-dirty]').should('have.attr','data-lineup-dirty','true');
  button(1,'Odśwież skład').click();button(1,'Pobierz aktualny skład').click();client(1).find('[data-lineup-dirty]').should('have.attr','data-lineup-dirty','false');
 });
});
