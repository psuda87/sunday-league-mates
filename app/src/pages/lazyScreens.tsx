import { lazy, Suspense } from 'react';
import type { ComponentProps, ComponentType } from 'react';
import { IonSpinner } from '@ionic/react';

// Każdy ekran ładuje się dopiero przy pierwszym wejściu, co zmniejsza główny pakiet JS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyScreen<C extends ComponentType<any>>(load: () => Promise<{ default: C }>) {
  const Screen = lazy(load) as unknown as ComponentType<ComponentProps<C>>;
  return function LazyScreen(props: ComponentProps<C>) {
    return <Suspense fallback={<div role="status" aria-label="Ładowanie"><IonSpinner /></div>}><Screen {...props} /></Suspense>;
  };
}

export const LiveGroups = lazyScreen(() => import('../live/Groups'));
export const LiveMatches = lazyScreen(() => import('../live/Matches'));
export const GroupFinance = lazyScreen(() => import('../live/Finance'));
export const Players = lazyScreen(() => import('../ui/Players'));
export const AppearanceSettings = lazyScreen(() => import('../ui/AppearanceSettings'));
export const Events = lazyScreen(() => import('./Events'));
export const Settlements = lazyScreen(() => import('./Settlements'));
export const Notifications = lazyScreen(() => import('./Notifications'));
