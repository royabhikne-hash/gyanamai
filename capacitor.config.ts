import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7a39378f41f643d191ced40877ac6737',
  appName: 'studybuddyaiapptest01',
  webDir: 'dist',
  server: {
    url: 'https://7a39378f-41f6-43d1-91ce-d40877ac6737.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    minWebViewVersion: 60,
    backgroundColor: '#ffffff',
    allowMixedContent: true,
  },
  plugins: {
    TextToSpeech: {
      // Default TTS settings
    }
  }
};

export default config;
