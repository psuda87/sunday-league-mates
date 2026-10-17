export function capacityState(count: number, capacity: number) {
  const total = Math.max(0, Math.trunc(Number.isFinite(capacity) ? capacity : 0));
  const occupied = Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0));
  return { total, occupied, percent: total ? Math.min(100, occupied / total * 100) : 0,
    label: !total ? 'Limit niedostępny' : occupied >= total ? 'Komplet miejsc' : occupied >= 10 ? 'Minimum osiągnięte' : `Do minimum brakuje ${10 - occupied}` };
}
