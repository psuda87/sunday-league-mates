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

/** Mała złota plakietka „GOLD” (listy). Samo słowo Gold, bez „MVP” i bez korony. */
export function GoldTag() {
  return <span className="slm-gold-tag" role="img" aria-label="MVP Gold">GOLD</span>;
}

/** Laurowy znaczek „GOLD” z koroną na karcie zawodnika. */
export function GoldBadge() {
  return (
    <svg className="slm-gold-badge" viewBox="0 0 120 84" role="img" aria-label="MVP Gold" focusable="false">
      <defs>
        <linearGradient id="slm-gold-badge-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3bd" /><stop offset=".5" stopColor="#e8c15a" /><stop offset="1" stopColor="#a8741f" />
        </linearGradient>
      </defs>
      <g fill="url(#slm-gold-badge-fill)">
        <path d="M44 6l8 12 8-16 8 16 8-12 4 20H40z" />
        <path d="M24 66c-14-8-18-26-12-42 2 14 9 24 20 30-1 6-3 9-8 12zM96 66c14-8 18-26 12-42-2 14-9 24-20 30 1 6 3 9 8 12z" />
      </g>
      <text x="60" y="60" textAnchor="middle" fontSize="23" fontWeight="800" letterSpacing="1.5" fill="#fff8dc" stroke="#3b2606" strokeWidth="1.6" paintOrder="stroke">GOLD</text>
    </svg>
  );
}
