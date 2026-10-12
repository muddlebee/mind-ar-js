import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './checks/browser',
  testMatch: 'playground.spec.js',
  outputDir: '../../../try-on-artifacts/results',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: {width: 1280, height: 900},
    launchOptions: {args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
  },
  webServer: {
    command: 'npm run dev:try-on -- --mode test --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
