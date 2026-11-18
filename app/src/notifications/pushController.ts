/** Wspólny interfejs powiadomień systemowych: natywny (Android/FCM) i przeglądarkowy (PWA/Web Push). */
export interface PushController {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  beforeLogout(): Promise<void>;
  /** Czy to urządzenie ma aktualnie włączone powiadomienia systemowe (do podpisu przycisków). */
  isEnabled?(): boolean;
}
