import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import './mvpGold.css';

/**
 * MVP Gold w interfejsie. Źródło prawdy (kto jest aktualnym MVP Gold w grupie) nie istnieje jeszcze w backendzie,
 * więc domyślnie nikt nie ma złota. Podgląd wizualny włącza zmienna budowania VITE_MVP_GOLD_PREVIEW=1
 * (złoto dla zalogowanego użytkownika) — tylko do oceny wyglądu, bez wpływu na dane.
 */
const HoldersContext = createContext<ReadonlySet<string>>(new Set());

export const mvpGoldPreviewEnabled = (): boolean => import.meta.env?.VITE_MVP_GOLD_PREVIEW === '1';

export function MvpGoldProvider({ holders, previewUserId, children }: { holders?: Iterable<string>; previewUserId?: string; children: ReactNode }) {
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

/** Korona z klejnotami i napis „MVP” na karcie zawodnika. */
export function GoldBadge() {
  return (
    <svg className="slm-gold-badge" viewBox="0 0 120 92" role="img" aria-label="MVP Gold" focusable="false">
      <defs>
        <linearGradient id="slm-gold-badge-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d6" /><stop offset=".45" stopColor="#f2c94c" /><stop offset="1" stopColor="#a8741f" />
        </linearGradient>
      </defs>
      <g stroke="#5a3b0c" strokeWidth="1.4" strokeLinejoin="round">
        <path fill="url(#slm-gold-badge-fill)" d="M30 44 L24 14 L43 30 L60 6 L77 30 L96 14 L90 44 Z" />
        <rect fill="url(#slm-gold-badge-fill)" x="29" y="44" width="62" height="9" rx="3" />
      </g>
      <g fill="#fff8d6" stroke="#5a3b0c" strokeWidth="1">
        <circle cx="24" cy="13" r="4" /><circle cx="60" cy="6" r="4.6" /><circle cx="96" cy="13" r="4" />
      </g>
      <g stroke="#5a3b0c" strokeWidth=".8">
        <circle cx="60" cy="33" r="4.2" fill="#d6263c" /><circle cx="44" cy="38" r="2.6" fill="#fff8d6" /><circle cx="76" cy="38" r="2.6" fill="#fff8d6" />
      </g>
      <text x="60" y="86" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="30" fontWeight="900" letterSpacing="3" fill="url(#slm-gold-badge-fill)" stroke="#3b2606" strokeWidth="1.8" paintOrder="stroke">MVP</text>
    </svg>
  );
}

const SPARKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [8, 22, 0, 10], [50, 3, .9, 12], [92, 22, 1.7, 10], [4, 52, 2.4, 8], [96, 55, .4, 9], [10, 80, 1.3, 9], [90, 81, 2.9, 10], [30, 93, 2, 8], [70, 93, .7, 8], [50, 98, 3.3, 11],
];
/** Iskrzące punkty na krawędziach złotej karty (czysty CSS, bez kosztów serwera). */
export function GoldSparkles() {
  return (
    <span className="slm-gold-sparkles" aria-hidden="true">
      {SPARKS.map(([x, y, delay, size], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${delay}s` }} />)}
    </span>
  );
}
