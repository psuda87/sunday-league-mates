import { capacityState } from './capacity';
export default function MatchCapacityProgress({ count, capacity }: { count: number; capacity: number }) {
  const s = capacityState(count, capacity);
  return <div className="slm-capacity"><p><strong>{s.occupied}</strong> / {s.total} zawodników</p>
    <div className="slm-capacity-track" role="progressbar" aria-label="Zajęte miejsca, bez rezerwy" aria-valuemin={0} aria-valuemax={s.total || 1} aria-valuenow={Math.min(s.occupied, s.total)} aria-valuetext={`${s.occupied} z ${s.total}. ${s.label}`}>
      <span style={{ width: `${s.percent}%` }} />{s.total >= 10 && <i style={{ left: `${10 / s.total * 100}%` }} aria-hidden="true" />}</div>
    <small>{s.occupied >= 10 ? '✓' : '○'} {s.label} <span>Minimum 10</span></small></div>;
}
