import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7a39378f41f643d191ced40877ac6737',
  appName: 'Gyanam AI',
  webDir: 'dist',
  server: {
    url: 'https://7a39378f-41f6-43d1-91ce-d40877ac6737.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    minWebViewVersion: 60,
    backgroundColor: '#ffffff',
    allowMixedContent: true,
    appendUserAgent: 'GyanamAI-Android',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    TextToSpeech: {},
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a3a8a',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a3a8a',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
  },
};

export default config;
