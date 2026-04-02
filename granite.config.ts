import { defineConfig } from '@apps-in-toss/web-framework/config'

export default defineConfig({
  appName: 'onetwopunch',
  brand: {
    displayName: '원투펀치',
    primaryColor: '#FF8C00',
    icon: 'https://onetwo-punch.vercel.app/icons/icon-512.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
  webViewProps: {
    type: 'game',
  },
})
