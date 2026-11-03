import type { CapacitorConfig } from '@capacitor/cli';

const localAndroid = process.env.SLM_LOCAL_ANDROID === '1';
const config: CapacitorConfig = {
  appId: 'pl.psuda87.slm',
  appName: 'Sunday League Mates',
  webDir: process.env.SLM_ANDROID_STAGE3 === '1' ? 'dist-android-stage3' : process.env.SLM_B1_ANDROID === '1' ? 'dist-b1' : process.env.SLM_V1_LIVE_LOCAL === '1' ? 'dist-live-local' : 'dist',
  // Most natywny nie może logować argumentów SecureStorage (tokenów).
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false, allowMixedContent: localAndroid },
  // Native viewport has one inset owner on Android12 and newer WebViews alike.
  plugins: { SystemBars: { insetsHandling: 'disable' }, PushNotifications: { presentationOptions: [] } }
};

export default config;
