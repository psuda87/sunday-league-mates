// Exercise the real registered view callbacks. Native AppPlugin event delivery
// is a separate physical-device check; desktop Chrome is not an Android WebView.
const back=()=>cy.document().then(doc=>{
 const handlers:{priority:number;handler:(next:()=>void)=>void}[]=[];
 doc.dispatchEvent(new CustomEvent('ionBackButton',{detail:{register:(priority:number,handler:(next:()=>void)=>void)=>handlers.push({priority,handler})}}));
 handlers.sort((a,b)=>b.priority-a.priority);const next=()=>handlers.shift()?.handler(next);next();
 return new Cypress.Promise(resolve=>setTimeout(resolve,50));
});
describe('Frozen Android callbacks — no visual changes',()=>{
 it('returns through the original profile frame, detail, group form and account screens',()=>{
  cy.viewport(390,844);cy.visit('/');
  cy.get('.slm-card-link').first().click();cy.get('[role=tab]').should('exist');
  cy.contains('[role=tab]','Składy').click();cy.get('.slm-football-pitch button').first().click();
  cy.get('.slm-ultimate-card').should('be.visible');back();cy.contains('[role=tab][aria-selected=true]','Składy').should('exist');
  back();cy.get('.slm-card-link').should('be.visible');
  cy.contains('nav button','Grupy').click();cy.contains('button','Utwórz grupę').click();cy.contains('h1','Nowa grupa').should('be.visible');
  back();cy.contains('h1','Moje grupy').should('be.visible');back();cy.get('.slm-card-link').should('be.visible');
  cy.get('.slm-demo-create').click();cy.get('.slm-event-form').should('be.visible');back();cy.get('.slm-event-form').should('not.exist');
  cy.contains('nav button','Profil').click();cy.contains('button','Edytuj profil').click();cy.get('.slm-identity-editor').should('be.visible');
  back();cy.get('.slm-identity-editor').should('not.exist');back();cy.get('.slm-card-link').should('be.visible');
  cy.visit('/#account/register');back();cy.contains('h1','Zaloguj się').should('be.visible');
 });
});
