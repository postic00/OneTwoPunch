import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.postic.onetwopunch',
  appName: '원투펀치',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-1253913975799895~1199842734',
    },
  },
};

export default config;
