export type Team = 'a' | 'b';
export type Assignment = Readonly<Record<string, Team>>;
export interface LineupEditor {
  eventId: string;
  baseline: Assignment;
  draft: Assignment;
  initialized: boolean;
  mode: 'swap' | 'transfer' | null;
  selected: string | null;
}
export type LineupAction =
  | {type: 'roster'; eventId: string; ids: string[]}
  | {type: 'preview'; ids: string[]}
  | {type: 'mode'; mode: LineupEditor['mode']}
  | {type: 'choose'; id: string}
  | {type: 'transfer'}
  | {type: 'assign'; id: string; side: Team}
  | {type: 'restore'};

export const emptyLineup = (eventId: string): LineupEditor => ({
  eventId, baseline: {}, draft: {}, initialized: false, mode: null, selected: null,
});
export function lineupChanged(baseline: Assignment, draft: Assignment): boolean {
  return [...new Set([...Object.keys(baseline), ...Object.keys(draft)])]
    .some(id => baseline[id] !== draft[id]);
}

// Participation IDs (including guests), never account IDs. No persistence or API writes.
export function editLineup(state: LineupEditor, action: LineupAction): LineupEditor {
  if (action.type === 'roster') {
    if (state.eventId !== action.eventId) return emptyLineup(action.eventId);
    const ids = new Set(action.ids);
    const retain = (source: Assignment): Assignment => Object.fromEntries(Object.entries(source).filter(([id]) => ids.has(id)));
    return {...state, baseline: retain(state.baseline), draft: retain(state.draft), selected: null};
  }
  if (action.type === 'preview') {
    if (state.initialized || new Set(action.ids).size < 2) return state;
    const baseline: Assignment = Object.fromEntries([...new Set(action.ids)].map((id, i) => [id, i % 2 === 0 ? 'a' : 'b']));
    return {...state, baseline, draft: {...baseline}, initialized: true, selected: null};
  }
  if (action.type === 'restore') return {...state, draft: {...state.baseline}, selected: null, mode: null, initialized: Object.keys(state.baseline).length > 0};
  if (action.type === 'mode') return {...state, mode: action.mode, selected: null};
  if (action.type === 'assign') {
    if (state.draft[action.id]) return state;
    return {...state, draft: {...state.draft, [action.id]: action.side}, initialized: true, selected: null};
  }
  if (action.type === 'transfer') {
    const side = state.selected && state.draft[state.selected];
    if (state.mode !== 'transfer' || !state.selected || !side) return state;
    return {...state, draft: {...state.draft, [state.selected]: side === 'a' ? 'b' : 'a'}, selected: null};
  }
  if (!state.mode || !state.draft[action.id]) return state;
  if (state.selected === action.id) return {...state, selected: null};
  if (state.mode === 'swap' && state.selected && state.draft[state.selected] && state.draft[state.selected] !== state.draft[action.id]) {
    return {...state, draft: {...state.draft, [action.id]: state.draft[state.selected], [state.selected]: state.draft[action.id]}, selected: null};
  }
  return {...state, selected: action.id};
}
