import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LineupPreview from './LineupPreview';
import type { LiveEntry } from './LineupPreview';
import MatchRoster from './MatchRoster';
import { portraitFramingStyle } from '../ui/portraitFraming';
const entry=(id:string,status:LiveEntry['status']='registered',member:string|null=id):LiveEntry=>({id,member_id:member,responsible_user_id:'owner',status,absent:false,display_name:'Osoba '+id,guest_name:member?null:'Gość',guest_phone:null,responsible_name:'Opiekun',contact_phone:''});

test('podział jest ręczny i nietrwały; rezerwa i wycofani nigdy nie trafiają na boisko',()=>{
  const entries=[entry('one'),entry('two'),entry('reserve','reserve'),entry('old','withdrawn')],open=vi.fn();
  const {rerender,unmount}=render(<LineupPreview entries={entries} cancelled={false} onPlayer={open}/>);
  expect(screen.getByLabelText('Drużyna A, 0 osób')).toBeInTheDocument();
  expect(screen.queryByLabelText('Drużyna dla Osoba reserve')).toBeNull();
  fireEvent.click(screen.getByText(/Ustaw lokalny podział/));
  fireEvent.change(screen.getByLabelText('Drużyna dla Osoba one'),{target:{value:'a'}});
  fireEvent.change(screen.getByLabelText('Drużyna dla Osoba two'),{target:{value:'b'}});
  fireEvent.click(screen.getByRole('button',{name:'Otwórz kartę: Osoba one'}));expect(open).toHaveBeenCalledWith('one');
  rerender(<LineupPreview entries={[entry('one','reserve'),entry('two')]} cancelled={false} onPlayer={open}/>);
  expect(screen.getByLabelText('Drużyna A, 0 osób')).toBeInTheDocument();
  unmount();render(<LineupPreview entries={entries} cancelled={false} onPlayer={open}/>);
  expect(screen.getByLabelText('Drużyna B, 0 osób')).toBeInTheDocument();
});

test('kompaktowa lista zachowuje uprawnienia i przekazuje istniejącą operację z id wpisu',()=>{
  const action=vi.fn(),open=vi.fn(),entries=[entry('own'),{...entry('foreign'),responsible_user_id:'other'},entry('guest','reserve',null)];
  const props={entries,userId:'owner',canManage:false,registrationOpen:true,fullAccess:true,busy:false,approved:false,onPlayer:open,onAction:action};
  const {rerender}=render(<MatchRoster {...props}/>);
  expect(screen.queryByLabelText('Opcje uczestnika: Osoba foreign')).toBeNull();
  expect(screen.getAllByText('Usuń udział')).toHaveLength(2);
  fireEvent.click(screen.getByLabelText('Opcje uczestnika: Osoba own'));
  fireEvent.click(screen.getAllByText('Usuń udział')[0]);expect(action).toHaveBeenCalledWith('withdraw',{participant_id:'own'});
  rerender(<MatchRoster {...props} canManage/>);
  expect(screen.getByLabelText('Opcje uczestnika: Osoba foreign')).toBeInTheDocument();
  rerender(<MatchRoster {...props} registrationOpen={false} fullAccess={false}/>);
  expect(screen.queryByRole('button',{name:'Osoba own'})).toBeNull();
  expect(screen.queryByLabelText('Opcje uczestnika: Osoba own')).toBeNull();
});

test('przyszłe kadrowanie ogranicza zoom i pozycję bez zmiany danych zdjęcia',()=>{
  expect(portraitFramingStyle({x:-5,y:150,zoom:9})).toMatchObject({'--portrait-x':'0%','--portrait-y':'100%','--portrait-zoom':3});
});
