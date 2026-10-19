import { capacityState } from './capacity';
export default function MatchCapacityProgress({ count, capacity, minimum = 10 }: { count: number; capacity: number; minimum?:number }) {
  const s = capacityState(count, capacity, minimum);
  return <div className="slm-capacity"><p><strong>{s.occupied}</strong> / {s.total} zawodników</p>
    <div className="slm-capacity-track" role="progressbar" aria-label="Zajęte miejsca, bez rezerwy" aria-valuemin={0} aria-valuemax={s.total || 1} aria-valuenow={Math.min(s.occupied, s.total)} aria-valuetext={`${s.occupied} z ${s.total}. ${s.label}`}>
      <span style={{ width: `${s.percent}%` }} />{s.total >= minimum && <i style={{ left: `${minimum / s.total * 100}%` }} aria-hidden="true" />}</div>
    <small>{s.occupied >= minimum ? '✓' : '○'} {s.label} <span>Minimum {minimum}</span></small></div>;
}
