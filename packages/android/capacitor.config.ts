import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cutthecord.app',
  appName: 'CutTheCord',
  webDir: 'www',
  server: {
    url: 'http://localhost:3000',
  },
};

export default config;
