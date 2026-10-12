import {test, expect} from '@playwright/test';

test('portable production build browses without camera/model requests and handles a failed WASM download', async ({page}) => {
  const requests = [];
  page.on('request', (request) => requests.push({url: request.url(), method: request.method()}));
  await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', {name: 'Color-pop paint', exact: true}).click();
  await expect(page.locator('#selection-count')).toHaveText('1 / 5');
  expect(requests.some(({url}) => /mediapipe|googleapis/.test(url))).toBe(false);
  expect(await page.evaluate(() => window.__fixture)).toBeUndefined();
  await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect(page.locator('#status-message')).toContainText('model/WASM', {timeout: 20000});
  await expect(page.locator('#camera-stage video')).toHaveCount(0);
  expect(requests.some(({url}) => url.includes('@mediapipe/tasks-vision@0.10.9/wasm/'))).toBe(true);
  expect(requests.every(({method}) => method === 'GET')).toBe(true);
  await page.getByRole('button', {name: 'Color-pop paint', exact: true}).click();
  await expect(page.locator('#selection-count')).toHaveText('0 / 5');
});

test('actual pinned MediaPipe runtime loads on a synthetic camera stream', async ({page}) => {
  test.skip(process.env.TRY_ON_NETWORK !== '1', 'Opt-in integration check requires external model/WASM downloads; still uses a synthetic camera.');
  const requests = [], errors = [], failedRequests = [], consoleErrors = [];
  page.on('request', (request) => requests.push({url: request.url(), method: request.method()}));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 400)); });
  if (process.env.TRY_ON_NETWORK_BRIDGE === '1') {
    // Test transport only. Node can use the environment's trusted CA while a
    // fresh Chromium profile cannot. Never disable browser TLS validation.
    await page.route(/^https:\/\/(cdn\.jsdelivr\.net|storage\.googleapis\.com)\//, async (route) => {
      const response = await route.fetch({timeout: 45000});
      await route.fulfill({response});
    });
  }
  await page.goto('/');
  const began = Date.now();
  await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect(page.locator('#camera-label')).toHaveText(/Camera ready|Camera needs attention/, {timeout: 45000});
  console.log(JSON.stringify({failedRequests, consoleErrors, status: await page.locator('#status-message').textContent()}));
  await expect(page.locator('#camera-label')).toHaveText('Camera ready');
  const syntheticStartupMs = Date.now() - began;
  expect(requests.some(({url}) => url.includes('face_landmarker/float16/1/face_landmarker.task'))).toBe(true);
  expect(requests.every(({method}) => method === 'GET')).toBe(true);
  expect(errors).toEqual([]);
  await page.getByRole('button', {name: 'Stop camera', exact: true}).click();
  await expect(page.locator('#camera-stage video')).toHaveCount(0);
  console.log(JSON.stringify({check: 'production runtime on synthetic stream; no physical face', bridgedTransport: process.env.TRY_ON_NETWORK_BRIDGE === '1', syntheticStartupMs}));
});
