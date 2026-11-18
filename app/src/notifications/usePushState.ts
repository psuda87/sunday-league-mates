import { useEffect, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { PUSH_STATUS_EVENT, pushFor, pushStatusText } from './shared';
import { webPushSupported } from './webPush';

/** Stan powiadomień systemowych tego urządzenia do wyświetlenia w dzwonku. */
export function usePushState(manager: SessionManager) {
  const push = pushFor(manager);
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick(v => v + 1);
    window.addEventListener(PUSH_STATUS_EVENT, refresh);
    return () => window.removeEventListener(PUSH_STATUS_EVENT, refresh);
  }, []);
  const supported = !!push && webPushSupported();
  const enabled = supported && !!push?.isEnabled?.();
  const denied = supported && Notification.permission === 'denied';
  return { push, supported, enabled, denied, status: pushStatusText(), refresh: () => tick(v => v + 1) };
}
