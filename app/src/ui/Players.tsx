import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import MatchHeader from './MatchHeader';
export interface PlayerSummary { key: string; name: string }
const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });
const searchText = (value: string) => value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').trim();
const initials = (name: string) => name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('pl');
export default function Players({ players, demo = false, unavailable = false, onNavigate, action }: { players: readonly PlayerSummary[]; demo?: boolean; unavailable?: boolean; onNavigate?: () => void; action?: ReactNode }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const lastButton = useRef<string | null>(null);
  const player = players.find(item => item.key === selected);
  const visible = [...players].sort((a, b) => collator.compare(a.name, b.name)).filter(item => searchText(item.name).includes(searchText(query)));
  function back() { setSelected(null); onNavigate?.(); requestAnimationFrame(() => lastButton.current && document.getElementById(lastButton.current)?.focus()); }
  return <div className="slm-players-screen">
    <MatchHeader action={action} title="Zawodnicy" backLabel="Wróć do zawodników" onBack={player ? back : undefined} />
    {demo && <p className="slm-players-demo">Dane przykładowe · fikcyjni zawodnicy</p>}
    {player ? <>
      <section className="slm-player-card" aria-label="Profil zawodnika">
        <p className="slm-player-eyebrow">SUNDAY LEAGUE MATES</p>
        <span className="slm-player-portrait" aria-hidden="true">{initials(player.name)}</span>
        <h2 tabIndex={-1} ref={element => { if (element) element.focus({ preventScroll: true }); }}>{player.name}</h2>
        <p>{demo ? 'Profil demonstracyjny' : 'Zawodnik grupy'}</p>
      </section>
      <section className="slm-player-stats" aria-labelledby={`${id}-stats`}><h2 id={`${id}-stats`}>Statystyki</h2><p className="slm-planned">W przygotowaniu</p><p>Statystyki będą dostępne po potwierdzeniu obecności i udostępnieniu wiarygodnych danych.</p></section>
    </> : unavailable ? <section className="slm-player-empty" role="status"><h2>Katalog grupy w przygotowaniu</h2><p>Obecne API nie udostępnia listy zawodników członkom grupy. Listę uczestników konkretnego meczu znajdziesz w jego szczegółach.</p></section> : <>
      <label className="slm-player-search" htmlFor={`${id}-search`}><span>Szukaj zawodnika</span><input ref={field} id={`${id}-search`} type="search" autoComplete="off" placeholder="Wpisz nazwę…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <p className="slm-player-count" role="status">{visible.length} z {players.length} zawodników · A–Z</p>
      {visible.length ? <ul className="slm-player-list">{visible.map(item => <li key={item.key}><button id={`${id}-${item.key}`} type="button" onClick={() => { lastButton.current = `${id}-${item.key}`; setSelected(item.key); onNavigate?.(); }}><span className="slm-player-avatar" aria-hidden="true">{initials(item.name)}</span><span className="slm-player-name">{item.name}</span><span className="slm-player-arrow" aria-hidden="true">›</span></button></li>)}</ul> : <section className="slm-player-empty"><h2>{players.length ? 'Brak wyników' : 'Lista jest pusta'}</h2><p>{players.length ? 'Spróbuj wpisać inną nazwę zawodnika.' : 'Nie ma jeszcze zawodników do wyświetlenia.'}</p>{query && <button type="button" onClick={() => { setQuery(''); field.current?.focus(); }}>Wyczyść wyszukiwanie</button>}</section>}
    </>}
  </div>;
}
