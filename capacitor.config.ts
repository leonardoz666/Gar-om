import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.garcom.app',
  appName: 'Garçom App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
