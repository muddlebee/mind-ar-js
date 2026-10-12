import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './checks/browser',
  testMatch: 'production.spec.js',
  outputDir: '../../../try-on-artifacts/production-results',
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(process.env.TRY_ON_BROWSER_PROXY ? {proxy: {server: process.env.TRY_ON_BROWSER_PROXY, bypass: '127.0.0.1,localhost'}} : {}),
    viewport: {width: 1280, height: 900},
    launchOptions: {args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
  },
  webServer: {command: 'npm run preview:try-on -- --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: false},
});
