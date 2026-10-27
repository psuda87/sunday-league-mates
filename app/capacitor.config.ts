import type { CapacitorConfig } from '@capacitor/cli';

const onlineAndroid=process.env.SLM_ONLINE_ANDROID==='1';
const localAndroid = !onlineAndroid&&process.env.SLM_LOCAL_ANDROID === '1';
const config: CapacitorConfig = {
  appId: 'pl.psuda87.slm',
  appName: 'Sunday League Mates',
  webDir: onlineAndroid?'dist-online-candidate':process.env.SLM_B1_ANDROID === '1' ? 'dist-b1' : process.env.SLM_V1_LIVE_LOCAL === '1' ? 'dist-live-local' : 'dist',
  // Most natywny nie może logować argumentów SecureStorage (tokenów).
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false, allowMixedContent: localAndroid },
  plugins: { PushNotifications: { presentationOptions: [] } }
};

export default config;
