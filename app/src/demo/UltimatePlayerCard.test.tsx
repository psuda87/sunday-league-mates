import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import UltimatePlayerCard from './UltimatePlayerCard';
it('renders only identity and the fixed portrait, with initials on missing or broken images',()=>{
 const {rerender}=render(<UltimatePlayerCard name="Kamil Zieliński" portrait={{src:'/assets/demo/fictional-portraits.webp',column:1,row:0}}/>);
 expect(screen.getByRole('heading',{name:'Kamil Zieliński'})).toBeTruthy();
 expect(screen.queryByText(/MVP|Ocena|Wiek|Waga|Wzrost/)).toBeNull();
 expect(document.querySelector('.slm-ultimate-portrait')).toHaveAttribute('data-portrait','1-0');
 fireEvent.error(screen.getByAltText('Fikcyjny portret demonstracyjny: Kamil Zieliński'));
 expect(screen.getByLabelText('Brak zdjęcia: Kamil Zieliński')).toHaveTextContent('KZ');
 rerender(<UltimatePlayerCard name="Oskar Król"/>);
 expect(screen.getByLabelText('Brak zdjęcia: Oskar Król')).toHaveTextContent('OK');
 expect(screen.queryByLabelText(/Numer koszulki/)).toBeNull();
});

it('supports a future single portrait by src without requiring a contact sheet',()=>{
 render(<UltimatePlayerCard name="Alex Nowak" portrait={{src:'/local-portrait.webp'}}/>);
 expect(document.querySelector('.slm-ultimate-portrait')).toHaveAttribute('data-layout','single');
 expect(screen.getByAltText('Fikcyjny portret demonstracyjny: Alex Nowak')).toHaveAttribute('src','/local-portrait.webp');
});

it('shows a read-only zero number and five purely decorative stars, with editing only when provided',()=>{
 const edit=vi.fn();const {rerender}=render(<UltimatePlayerCard name="Alex Nowak" jerseyNumber={0}/>);
 expect(screen.getByLabelText('Numer koszulki 0')).toHaveTextContent('0');
 expect(screen.queryByRole('button',{name:/Zmień numer/})).toBeNull();
 expect(document.querySelector('.slm-ultimate-stars')).toHaveAttribute('aria-hidden','true');
 expect(document.querySelector('.slm-ultimate-stars')).toHaveTextContent('★★★★★');
 rerender(<UltimatePlayerCard name="Alex Nowak" jerseyNumber={99} onEditNumber={edit}/>);
 fireEvent.click(screen.getByRole('button',{name:'Zmień numer koszulki, obecnie 99'}));expect(edit).toHaveBeenCalledOnce();
});
