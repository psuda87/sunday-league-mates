export type MatchFilter = 'upcoming' | 'mine' | 'history';
export default function MatchFilters({ value, onChange, mineUnavailable = false }: { value: MatchFilter; onChange: (value: MatchFilter) => void; mineUnavailable?: boolean }) {
  return <nav className="slm-match-filters" aria-label="Filtr meczów">{([
    ['upcoming', 'Nadchodzące'], ['mine', 'Moje'], ['history', 'Historia'],
  ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} disabled={key === 'mine' && mineUnavailable} title={key === 'mine' && mineUnavailable ? 'Lista nie udostępnia informacji o Twoich zapisach' : undefined} onClick={() => onChange(key)}>{label}</button>)}</nav>;
}
