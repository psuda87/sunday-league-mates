import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.psuda87.slm',
  appName: 'Sunday League Mates',
  webDir: process.env.SLM_FROZEN_UI_ANDROID === '1' ? 'dist-demo' : 'dist',
  // Most natywny nie może logować argumentów SecureStorage (tokenów).
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false },
  plugins: { PushNotifications: { presentationOptions: [] } }
};

export default config;
