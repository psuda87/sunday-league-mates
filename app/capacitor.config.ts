import type { CapacitorConfig } from '@capacitor/cli';

const localAndroid = process.env.SLM_LOCAL_ANDROID === '1';
const config: CapacitorConfig = {
  appId: 'pl.psuda87.slm',
  appName: 'Sunday League Mates',
  webDir: 'dist',
  // Most natywny nie może logować argumentów SecureStorage (tokenów).
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false, allowMixedContent: localAndroid },
  plugins: { PushNotifications: { presentationOptions: [] } }
};

export default config;
