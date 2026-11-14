import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import './mvpGold.css';

/**
 * MVP Gold w interfejsie. Źródło prawdy (kto jest aktualnym MVP Gold w grupie) nie istnieje jeszcze w backendzie,
 * więc domyślnie nikt nie ma złota. Podgląd wizualny włącza zmienna budowania VITE_MVP_GOLD_PREVIEW=1
 * (złoto dla zalogowanego użytkownika) — tylko do oceny wyglądu, bez wpływu na dane.
 */
const HoldersContext = createContext<ReadonlySet<string>>(new Set());

export const mvpGoldPreviewEnabled = (): boolean => import.meta.env?.VITE_MVP_GOLD_PREVIEW === '1';

/** Cztery ukośne kierunki refleksu: [x0, y0, x1, y1, kąt pasma]. */
export const REFLEX_DIRECTIONS = [
  ['-130%', '-130%', '130%', '130%', '135deg'], // z lewej góry w prawy dół
  ['130%', '-130%', '-130%', '130%', '45deg'], // z prawej góry w lewy dół
  ['-130%', '130%', '130%', '-130%', '45deg'], // z lewego dołu w prawą górę
  ['130%', '130%', '-130%', '-130%', '135deg'], // z prawego dołu w lewą górę
] as const;

/** Losuje następny kierunek, inny niż poprzedni, i zapisuje go w zmiennych CSS elementu. */
export function applyRandomReflex(element: HTMLElement, random: () => number = Math.random): number {
  const previous = Number(element.dataset.slmReflex ?? -1);
  let next = Math.floor(random() * REFLEX_DIRECTIONS.length) % REFLEX_DIRECTIONS.length;
  if (next === previous) next = (next + 1) % REFLEX_DIRECTIONS.length;
  const [x0, y0, x1, y1, angle] = REFLEX_DIRECTIONS[next];
  element.dataset.slmReflex = String(next);
  element.style.setProperty('--slm-gold-x0', x0); element.style.setProperty('--slm-gold-y0', y0);
  element.style.setProperty('--slm-gold-x1', x1); element.style.setProperty('--slm-gold-y1', y1);
  element.style.setProperty('--slm-gold-angle', angle);
  return next;
}

/** Po każdym obiegu pętli refleksu (pasmo jest wtedy poza elementem) wybiera nowy losowy kierunek. */
function useRandomReflexDirections() {
  useEffect(() => {
    const onIteration = (event: AnimationEvent) => {
      if (event.animationName === 'slm-gold-sweep' && event.target instanceof HTMLElement) applyRandomReflex(event.target);
    };
    document.addEventListener('animationiteration', onIteration);
    return () => document.removeEventListener('animationiteration', onIteration);
  }, []);
}

export function MvpGoldProvider({ holders, previewUserId, children }: { holders?: Iterable<string>; previewUserId?: string; children: ReactNode }) {
  useRandomReflexDirections();
  const value = useMemo(() => {
    const set = new Set<string>(holders ?? []);
    if (previewUserId && mvpGoldPreviewEnabled()) set.add(previewUserId);
    return set;
  }, [holders, previewUserId]);
  return <HoldersContext.Provider value={value}>{children}</HoldersContext.Provider>;
}

/** Zbiór identyfikatorów z aktywnym MVP Gold (do renderowania wielu wierszy w jednym komponencie). */
export const useMvpGoldHolders = (): ReadonlySet<string> => useContext(HoldersContext);

export function useMvpGold(userId?: string | null): boolean {
  const holders = useContext(HoldersContext);
  return !!userId && holders.has(userId);
}

/** Mała złota plakietka „MVP” (listy). */
export function GoldTag() {
  return <span className="slm-gold-tag" role="img" aria-label="MVP Gold">MVP</span>;
}

/** Sam napis „MVP” na karcie zawodnika (bez korony i laurów — decyzja właściciela 14.11.2026). */
export function GoldBadge() {
  return (
    <svg className="slm-gold-badge" viewBox="0 0 120 40" role="img" aria-label="MVP Gold" focusable="false">
      <defs>
        <linearGradient id="slm-gold-badge-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d6" /><stop offset=".45" stopColor="#f2c94c" /><stop offset="1" stopColor="#a8741f" />
        </linearGradient>
      </defs>
      <text x="60" y="31" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="32" fontWeight="900" letterSpacing="4" fill="url(#slm-gold-badge-fill)" stroke="#3b2606" strokeWidth="1.8" paintOrder="stroke">MVP</text>
    </svg>
  );
}

const SPARKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [10, 20, 0, 34], [90, 20, 1.6, 30], [3, 56, 3.1, 26], [97, 60, .8, 30], [22, 90, 2.3, 28], [78, 90, 3.8, 26],
];
/** Miękkie błyski światła na krawędzi złotej karty (czysty CSS, bez kosztów serwera). */
export function GoldSparkles() {
  return (
    <span className="slm-gold-sparkles" aria-hidden="true">
      {SPARKS.map(([x, y, delay, size], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${delay}s` }} />)}
    </span>
  );
}
