import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionManager } from '../auth/sessionManager';

const controller = { isEnabled: vi.fn(() => false), enable: vi.fn(async () => undefined), disable: vi.fn(async () => undefined) };
vi.mock('./shared', async importOriginal => ({ ...(await importOriginal<typeof import('./shared')>()), pushFor: () => controller }));
vi.mock('./webPush', async importOriginal => ({ ...(await importOriginal<typeof import('./webPush')>()), webPushSupported: () => true }));
import PushSection from './PushSection';

const manager = {} as SessionManager;
afterEach(() => { vi.clearAllMocks(); controller.isEnabled.mockReturnValue(false); });

describe('PushSection', () => {
  it('pokazuje przycisk włączenia i wywołuje enable po kliknięciu', async () => {
    vi.stubGlobal('Notification', { permission: 'default' });
    render(<PushSection manager={manager} />);
    fireEvent.click(screen.getByRole('button', { name: 'Włącz powiadomienia' }));
    await waitFor(() => expect(controller.enable).toHaveBeenCalledTimes(1));
  });
  it('po włączeniu pokazuje stan i pozwala wyłączyć', () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    controller.isEnabled.mockReturnValue(true);
    render(<PushSection manager={manager} />);
    expect(screen.getByText(/Włączone na tym urządzeniu/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz' }));
    expect(controller.disable).toHaveBeenCalledTimes(1);
  });
  it('przy zablokowanej zgodzie nie oferuje przycisku włączenia', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    render(<PushSection manager={manager} />);
    expect(screen.queryByRole('button', { name: 'Włącz powiadomienia' })).toBeNull();
    expect(screen.getByText(/zablokowane w ustawieniach przeglądarki/)).toBeTruthy();
  });
});
