import { MIN_RATED_MATCHES_FOR_CHANGE, PROVISIONAL_WEIGHTS, RATING_MAX, RATING_MIN, RATING_START, clampRating } from './rating';

/**
 * WERSJA PRÓBNA — propozycja do zatwierdzenia przez właściciela, NIEPODŁĄCZONA do aplikacji ani do bazy.
 * Realizuje zapisane założenia (docs/rating/SLM_RATING_1_0_MVP_GOLD.md): wagi 80/12/5/3, rating 1–10 z jednym
 * miejscem po przecinku, start 7,0, zmiany dopiero po 5 ocenionych meczach, malejąca korzyść z goli/asyst,
 * frekwencja wyłącznie na plus, premie z limitem (MVP nie dominuje nad ocenami kolegów).
 * Wygładzanie, skale premii i normalizacja między grupami wymagają odrębnej akceptacji.
 */
export const RATING_FORMULA_VERSION = 'proposal-0.1';
/** Waga wstępnego przekonania (liczba „wirtualnych” ocen równych 7) — łagodzi rzadkie oceny. */
export const PRIOR_WEIGHT = 5;
/** Maksymalny zysk każdej premii względem neutralnych 7,0 (w punktach skali 1–10). */
export const BONUS_SPAN = 3;
/** Skala malejącej korzyści: ok. 63% maksimum premii przy 4 golach+asystach na mecz (średnio). */
export const GOALS_ASSISTS_SCALE = 4;
/** Średnia liczba jednostek MVP na mecz, przy której premia MVP osiąga maksimum. */
export const MVP_RATE_FOR_MAX = 0.5;

export interface RatingInput {
  /** Oceny od kolegów, 1–10 (po jednej na ocenę, już po odrzuceniu własnych i spoza meczu). */
  peerScores: readonly number[];
  /** Liczba meczów ocenionych przez kolegów. */
  ratedMatches: number;
  /** Jednostki MVP: pełne Gold + akumulacja remisów (4 remisy = 1). */
  mvpUnits: number;
  goals: number;
  assists: number;
  /** Mecze rozegrane z puli kwalifikujących się. */
  matchesPlayed: number;
  /** Udział obecności 0–1 — tylko premia, bez kar. */
  attendance: number;
}

export interface RatingBreakdown {
  rating: number;
  provisional: boolean;
  components: { peer: number; mvp: number; goalsAssists: number; attendance: number };
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const unit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function computeRating(input: RatingInput): RatingBreakdown {
  const valid = input.peerScores.filter(score => Number.isFinite(score)).map(clampRating);
  const n = valid.length;
  const peer = (PRIOR_WEIGHT * RATING_START + valid.reduce((a, b) => a + b, 0)) / (PRIOR_WEIGHT + n);
  const played = Math.max(1, input.matchesPlayed);
  const mvp = RATING_START + BONUS_SPAN * unit(input.mvpUnits / played / MVP_RATE_FOR_MAX);
  const perMatch = Math.max(0, input.goals + input.assists) / played;
  const goalsAssists = RATING_START + BONUS_SPAN * (1 - Math.exp(-perMatch / GOALS_ASSISTS_SCALE));
  const attendance = RATING_START + BONUS_SPAN * unit(input.attendance);
  const components = { peer, mvp, goalsAssists, attendance };
  if (input.ratedMatches < MIN_RATED_MATCHES_FOR_CHANGE) return { rating: RATING_START, provisional: true, components };
  const w = PROVISIONAL_WEIGHTS;
  const composite = w.peers * peer + w.mvp * mvp + w.goalsAssists * goalsAssists + w.attendance * attendance;
  return { rating: round1(Math.min(RATING_MAX, Math.max(RATING_MIN, composite))), provisional: false, components };
}
