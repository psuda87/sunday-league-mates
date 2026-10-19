import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { dateEntry, timeEntry, displayEventDate, parseEventDate, formatEventDateTime } from './eventDraft';
import { initialWorld } from './data';
import EventForm from './EventForm';
afterEach(cleanup);
it('formats Polish numeric dates and Warsaw 24-hour time independent of browser locale',()=>{
 expect(displayEventDate('2026-10-20')).toBe('20.10.2026');expect(parseEventDate('20.10.2026')).toBe('2026-10-20');expect(parseEventDate('29.02.2028')).toBe('2028-02-29');
 for(const value of ['02/03/2026','2026-10-20','31.04.2026','29.02.2027','1.1.2027','bad'])expect(parseEventDate(value)).toBeNull();
 expect(formatEventDateTime('2026-10-20T16:00:00Z')).toBe('20.10.2026, 18:00');expect(formatEventDateTime('2026-12-01T17:00:00Z')).toBe('01.12.2026, 18:00');
});
it('uses controlled Polish text inputs on edit without changing the stored ISO instant',()=>{
 const world=initialWorld(),save=vi.fn();render(<EventForm world={world} game={world.games[0]} onBack={vi.fn()} onSave={save}/>);
 expect(screen.getByLabelText('Data')).toHaveValue('22.10.2026');expect(screen.getByLabelText('Data')).toHaveAttribute('type','text');expect(screen.getByLabelText('Godzina')).toHaveValue('18:00');
 fireEvent.change(screen.getByLabelText('Data'),{target:{value:'01.12.2026'}});fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));fireEvent.click(screen.getByRole('button',{name:'Zapisz zmiany'}));expect(save.mock.calls[0][0].startsAt).toBe('2026-12-01T17:00:00.000Z');
});
it('keeps invalid, past and ambiguous DST dates blocked in the controlled UI',()=>{
 const save=vi.fn();render(<EventForm world={initialWorld()} onBack={vi.fn()} onSave={save}/>);fireEvent.change(screen.getByLabelText('Grupa organizująca'),{target:{value:'group-1'}});
 for(const [date,time] of [['31.04.2027','18:00'],['01.01.2020','18:00'],['25.10.2026','02:30'],['01.12.2026','06:00 PM']]){fireEvent.change(screen.getByLabelText('Data'),{target:{value:date}});fireEvent.change(screen.getByLabelText('Godzina'),{target:{value:time}});fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));expect(screen.getByRole('alert')).toBeTruthy();expect(screen.queryByRole('button',{name:'Utwórz mecz'})).toBeNull();}expect(save).not.toHaveBeenCalled();
});

it('accepts numeric phone keyboard entry and keeps separators visible, without accepting AM/PM',()=>{
 expect(dateEntry('20102026')).toBe('20.10.2026');expect(dateEntry('20,10,2026')).toBe('20.10.2026');expect(dateEntry('20.')).toBe('20');expect(timeEntry('1800')).toBe('18:00');expect(timeEntry('18:')).toBe('18');expect(timeEntry('06:00 PM')).toBe('06:00 PM');
});
