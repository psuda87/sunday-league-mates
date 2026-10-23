export function requireMatchDetail<T extends { event: { id: string } }>(detail: T, requestedId: string): T {
  if (!detail?.event || detail.event.id !== requestedId)
    throw new Error('Nie udało się potwierdzić wybranego meczu. Odśwież listę i spróbuj ponownie.');
  return detail;
}
