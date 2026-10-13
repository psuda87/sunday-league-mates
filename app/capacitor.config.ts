import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.psuda87.slm',
  appName: 'Sunday League Mates',
  webDir: 'dist',
  // Most natywny nie może logować argumentów SecureStorage (tokenów).
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false }
};

export default config;
