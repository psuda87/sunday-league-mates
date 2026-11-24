// Katalog odznak SLM — jedno źródło nazw, opisów i progów dla UI (decyzje właściciela: docs/BADGES_PLAN.md).
// Warunki liczy serwer; tu jest wyłącznie prezentacja.
export type BadgeCategory = 'attendance' | 'results' | 'activity' | 'community' | 'humor';
export type BadgeScope = 'all_groups' | 'per_group';

export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  category: BadgeCategory;
  threshold: number;
  unit: string;
  scope: BadgeScope;
  /** Król strzelców: przyznawany za każdy rok kalendarzowy osobno (ta sama grafika). */
  yearly?: boolean;
  /** Odznaka wewnętrzna jednej grupy: lista pokazuje ją tylko, gdy serwer zwróci dla niej stan (członek grupy lub zdobywca). */
  exclusive?: boolean;
}

export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  attendance: 'Frekwencja', results: 'Wyniki', activity: 'Aktywność', community: 'Społeczność', humor: 'Z przymrużeniem oka',
};

const def = (code: string, name: string, description: string, category: BadgeCategory, threshold: number, unit: string,
  scope: BadgeScope = 'all_groups', yearly = false): BadgeDefinition => ({ code, name, description, category, threshold, unit, scope, ...(yearly ? { yearly } : {}) });

export const BADGES: readonly BadgeDefinition[] = [
  def('SLM-MAT-001', 'Debiutant', 'Pierwszy rozegrany mecz.', 'attendance', 1, 'mecz'),
  def('SLM-MAT-010', 'Stały bywalec', '10 rozegranych meczów.', 'attendance', 10, 'meczów'),
  def('SLM-MAT-050', 'Weteran', '50 rozegranych meczów.', 'attendance', 50, 'meczów'),
  def('SLM-MAT-100', 'Legenda boiska', '100 rozegranych meczów.', 'attendance', 100, 'meczów'),
  def('SLM-STR-010', 'Żelazne płuca', '10 kolejnych meczów grupy bez opuszczenia żadnego.', 'attendance', 10, 'meczów z rzędu', 'per_group'),
  def('SLM-MON-003', 'Kwartał na boisku', '3 miesiące z rzędu, w każdym co najmniej 2 rozegrane mecze.', 'attendance', 3, 'miesiące z rzędu'),
  def('SLM-MON-006', 'Pół roku na boisku', '6 miesięcy z rzędu, w każdym co najmniej 2 rozegrane mecze.', 'attendance', 6, 'miesięcy z rzędu'),
  def('SLM-MON-012', 'Rok na boisku', '12 miesięcy z rzędu, w każdym co najmniej 2 rozegrane mecze.', 'attendance', 12, 'miesięcy z rzędu'),
  def('SLM-YRS-2027', 'Regularny 2027', 'Co najmniej 80% meczów grupy w 2027 roku.', 'attendance', 80, '% meczów grupy', 'per_group'),
  def('SLM-GOL-100', 'Snajper', '100 goli (liczone mecze, w których bramki zgadzają się z wynikiem).', 'results', 100, 'goli'),
  def('SLM-TOP-001', 'Król strzelców', 'Najwięcej goli w grupie w roku kalendarzowym.', 'results', 1, 'tytuł', 'per_group', true),
  def('SLM-AST-100', 'Asystent', '100 asyst (liczone mecze, w których bramki zgadzają się z wynikiem).', 'results', 100, 'asyst'),
  def('SLM-WIN-005', 'Niezwyciężony', '5 wygranych meczów z rzędu.', 'results', 5, 'wygranych z rzędu'),
  def('SLM-ATT-020', 'Pewniak', '20 zapisów zakończonych grą.', 'activity', 20, 'zapisów'),
  def('SLM-REL-020', 'Niezawodny', '20 meczów bez nieobecności mimo zapisu i bez rezygnacji po 17:00.', 'activity', 20, 'meczów'),
  def('SLM-COM-001', 'Powrót króla', 'Powrót na boisko po co najmniej 60 dniach przerwy.', 'activity', 1, 'powrót'),
  def('SLM-GST-010', 'Rekruter', '10 przyprowadzonych gości, którzy zagrali (każdy gość liczy się osobno).', 'community', 10, 'gości'),
  def('SLM-BEN-010', 'Wieczny rezerwowy', '10 zapisów na rezerwę.', 'humor', 10, 'zapisów na rezerwę'),
  def('SLM-PHX-005', 'Feniks', 'Wygrana po 5 porażkach z rzędu.', 'humor', 1, 'wygrana'),
  def('SLM-LST-005', 'Człowiek ostatniej chwili', '5 zapisów w dniu meczu po 17:00.', 'humor', 5, 'zapisów'),
  { ...def('SLM-JUB-002', 'Jubileusz 2 lata', 'Gra w jubileuszowym meczu 3 grudnia 2026 w grupie Czwartkowy Baloon. Tylko za ten jeden mecz.', 'community', 1, 'mecz', 'per_group'), exclusive: true },
];

export const badgeAsset = (code: string) => `/assets/badges/${code}.webp`;
