import {test, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function choose(page, category, label) {
  await page.getByRole('tab', {name: category, exact: true}).click();
  await page.getByRole('button', {name: label, exact: true}).click();
}
async function start(page) {
  await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect(page.locator('#camera-label')).toHaveText('Face found', {timeout: 20000});
}

test('browse and mix before permission; keyboard tabs, toggle, clear, focus, and thumbnails', async ({page}) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await choose(page, 'Stickers', 'Star cheeks'); await choose(page, 'Eyewear', 'Round glasses');
  await expect(page.locator('#selection-count')).toHaveText('2 / 5');
  expect(await page.evaluate(() => window.__fixture)).toBeUndefined();
  expect(requests.some((url) => /mediapipe|three\.js|opencv/.test(url))).toBe(false);
  const tab = page.getByRole('tab', {name: 'Eyewear', exact: true});
  await tab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', {name: 'Headwear', exact: true})).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', {name: 'Face', exact: true})).toBeFocused();
  await page.getByRole('button', {name: 'Color-pop paint', exact: true}).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: 'Color-pop paint', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Carnival mask', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Color-pop paint', exact: true})).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#selection-count')).toHaveText('3 / 5');
  await page.getByRole('button', {name: 'Remove Carnival mask', exact: true}).click();
  await expect(page.locator('#selection-count')).toHaveText('2 / 5');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await page.getByRole('button', {name: 'Clear all', exact: true}).click();
  await expect(page.locator('#selection-count')).toHaveText('0 / 5');
  await expect(page.getByRole('tab', {name: 'Face', exact: true})).toBeFocused();
  expect(await page.locator('.effect-card img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
});

for (const [name, message] of [['NotAllowedError', 'site settings'], ['NotFoundError', 'No camera'], ['NotReadableError', 'other apps'], ['NotSupportedError', 'WebGL'], ['SecurityError', 'HTTPS']]) {
  test(`actionable ${name} state leaves picker usable`, async ({page}) => {
    await page.addInitScript((errorName) => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('controlled failure', errorName); }; }, name);
    await page.goto('/');
    await page.getByRole('button', {name: 'Start camera', exact: true}).click();
    await expect(page.locator('#status-message')).toContainText(message);
    await expect(page.getByRole('button', {name: 'Start camera', exact: true})).toBeEnabled();
    await choose(page, 'Headwear', 'Crown'); await expect(page.locator('#selection-count')).toHaveText('1 / 5');
    expect(await page.locator('#camera-stage video').count()).toBe(0);
  });
}

test('all ten effects render, mix, survive loss/reacquisition and reuse GPU resources', async ({page}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await choose(page, 'Stickers', 'Star cheeks'); await choose(page, 'Eyewear', 'Round glasses');
  await start(page);
  expect(await page.evaluate(() => window.__fixture.constraints.audio)).toBe(false);
  expect(await page.evaluate(() => window.__fixture.constraints.video.facingMode)).toBe('user');
  const catalog = [
    ['Face', 'Color-pop paint', 'Carnival mask'], ['Stickers', 'Heart cheeks', 'Star cheeks'],
    ['Eyewear', 'Pixel shades', 'Round glasses'], ['Headwear', 'Crown', 'Party hat'], ['Earrings', 'Hoops', 'Drop earrings'],
  ];
  for (const [category, ...labels] of catalog) {
    for (const label of labels) {
      await choose(page, category, label);
      await expect(page.getByRole('button', {name: label, exact: true})).toHaveAttribute('aria-busy', 'false');
      // WebGL allocates buffers lazily on the first draw, not on construction.
      await page.evaluate(() => { const {adapter} = window.__fixture; adapter.renderer.render(adapter.scene, adapter.camera); });
    }
  }
  await expect(page.locator('#selection-count')).toHaveText('5 / 5');
  const before = await page.evaluate(() => ({...window.__fixture.adapter.renderer.info.memory}));
  const rendered = await page.evaluate(() => {
    const {adapter} = window.__fixture;
    adapter.renderer.render(adapter.scene, adapter.camera);
    const gl = adapter.renderer.getContext(), width = adapter.renderer.domElement.width, height = adapter.renderer.domElement.height;
    const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let colored = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) colored++;
    return {colored, calls: adapter.renderer.info.render.calls, finite: adapter.latestEstimate.faceMatrix.every(Number.isFinite)};
  });
  expect(rendered.colored).toBeGreaterThan(100); expect(rendered.calls).toBeGreaterThan(5); expect(rendered.finite).toBe(true);
  for (const [category, ...labels] of catalog) for (const label of labels) await choose(page, category, label);
  await expect.poll(() => page.evaluate(() => ({...window.__fixture.adapter.renderer.info.memory}))).toEqual(before);
  expect(await page.evaluate(() => window.__fixture.cameraRequests)).toBe(1);
  expect(await page.evaluate(() => window.__fixture.modelLoads)).toBe(1);
  await page.evaluate(() => { window.__fixture.face = false; });
  await expect(page.locator('#camera-label')).toHaveText('Camera ready');
  expect(await page.evaluate(() => window.__fixture.adapter.anchors.every(({group}) => !group.visible))).toBe(true);
  await page.evaluate(() => { window.__fixture.face = true; window.__fixture.yaw = 0.35; });
  await expect(page.locator('#camera-label')).toHaveText('Face found');
  await expect(page.locator('#selection-count')).toHaveText('5 / 5');
  expect(errors).toEqual([]);
  await mkdir('try-on-artifacts', {recursive: true});
  await page.screenshot({path: 'try-on-artifacts/synthetic-desktop.png', fullPage: true});
});

test('effect failure retries without interrupting the camera; cleanup reaches zero GPU resources', async ({page}) => {
  await page.goto('/'); await choose(page, 'Eyewear', 'Round glasses'); await start(page);
  await page.evaluate(() => { window.__fixture.failEffect = true; });
  await choose(page, 'Stickers', 'Star cheeks');
  await expect(page.getByRole('button', {name: 'Retry Star cheeks', exact: true})).toBeVisible();
  await expect(page.locator('#camera-label')).toHaveText('Face found');
  await page.evaluate(() => { window.__fixture.failEffect = false; });
  await page.getByRole('button', {name: 'Retry Star cheeks', exact: true}).click();
  await expect(page.locator('#effect-errors')).toBeEmpty();
  expect(await page.evaluate(() => window.__fixture.cameraRequests)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: false})));
  await expect.poll(() => page.evaluate(() => ({...window.__fixture.adapter.renderer.info.memory}))).toEqual({geometries: 0, textures: 0});
  expect(await page.evaluate(() => window.__fixture.modelsClosed)).toBe(1);
  expect(await page.locator('#camera-stage').evaluate((element) => element.children.length)).toBe(0);
  expect(await page.evaluate(() => window.__fixture.streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')))).toBe(true);
});

test('ten real synthetic-stream start/stop cycles retain one model and no orphan loop', async ({page}) => {
  await page.goto('/'); await choose(page, 'Headwear', 'Crown');
  for (let i = 0; i < 10; i++) {
    await start(page);
    expect(await page.locator('#camera-stage video').count()).toBe(1);
    await page.getByRole('button', {name: 'Stop camera', exact: true}).click();
    await expect(page.locator('#camera-label')).toHaveText('Camera off');
    const stopped = await page.evaluate(() => ({frames: window.__fixture.frames, tracks: window.__fixture.streams.flatMap((stream) => stream.getTracks()).map((track) => track.readyState)}));
    expect(stopped.tracks.every((state) => state === 'ended')).toBe(true);
    await expect(page.locator('#camera-stage video')).toHaveCount(0);
    await page.waitForTimeout(60);
    expect(await page.evaluate(() => window.__fixture.frames)).toBe(stopped.frames);
  }
  expect(await page.evaluate(() => window.__fixture.cameraRequests)).toBe(10);
  expect(await page.evaluate(() => window.__fixture.modelLoads)).toBe(1);
  await expect(page.locator('#selection-count')).toHaveText('1 / 5');
});

test('responsive crop alignment, DPR cap, reduced motion, and asymmetric sticker', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844}); await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/'); await choose(page, 'Stickers', 'Star cheeks'); await start(page);
  expect(await page.evaluate(() => window.__fixture.adapter.renderer.getPixelRatio())).toBeLessThanOrEqual(2);
  const verifyLayout = async () => {
    const result = await page.evaluate(() => {
      const adapter = window.__fixture.adapter;
      const video = adapter.video.getBoundingClientRect(), canvas = adapter.renderer.domElement.getBoundingClientRect();
      const anchors = adapter.anchors.filter(({landmarkIndex}) => [50, 280].includes(landmarkIndex));
      return {overflow: document.documentElement.scrollWidth > innerWidth, video: [video.x, video.y, video.width, video.height], canvas: [canvas.x, canvas.y, canvas.width, canvas.height], mirroredVideo: getComputedStyle(adapter.video).transform, canvasTransform: getComputedStyle(adapter.renderer.domElement).transform,
        colors: anchors.map(({group}) => group.children[0].children.find((child) => child.material?.map)?.material.map.image.toDataURL()), positions: anchors.map(({group}) => group.matrix.elements[12]), aspect: adapter.camera.aspect};
    });
    expect(result.overflow).toBe(false);
    result.video.forEach((number, index) => expect(number).toBeCloseTo(result.canvas[index], 1));
    expect(result.mirroredVideo).toBe('matrix(-1, 0, 0, 1, 0, 0)'); expect(result.canvasTransform).toBe('none');
    expect(result.colors[0]).not.toBe(result.colors[1]); expect(result.positions[0]).toBeLessThan(result.positions[1]);
    expect(result.aspect).toBeCloseTo(640 / 480, 1);
  };
  await verifyLayout();
  await mkdir('try-on-artifacts', {recursive: true});
  await page.screenshot({path: 'try-on-artifacts/synthetic-mobile.png', fullPage: true});
  await page.setViewportSize({width: 844, height: 390});
  await page.waitForTimeout(150); await verifyLayout();
});

test('OpenCV temporary Mats release on every estimate and on solvePnP failure', async ({page}) => {
  await page.goto('/'); await start(page);
  const result = await page.evaluate(async () => {
    const {opencv} = window.__fixture;
    const adapter = window.__fixture.adapter;
    adapter.controller.stopProcessVideo();
    const live = new Set();
    const Mat = opencv.Mat, matFromArray = opencv.matFromArray, remove = Mat.prototype.delete, inverse = Mat.prototype.inv, solve = opencv.solvePnP;
    const own = (mat) => { live.add(mat); return mat; };
    Mat.prototype.delete = function () { live.delete(this); return remove.call(this); };
    Mat.prototype.inv = function (...args) { return own(inverse.apply(this, args)); };
    opencv.Mat = new Proxy(Mat, {construct: (target, args) => own(Reflect.construct(target, args, target)), get: (target, key) => key === 'zeros' ? (...args) => own(Mat.zeros(...args)) : Reflect.get(target, key)});
    opencv.matFromArray = (...args) => own(matFromArray(...args));
    let normal, failed;
    try {
      const {faceLandmarks} = await adapter.controller.faceMeshHelper.detect(adapter.video);
      const landmarks = faceLandmarks[0].map(({x, y, z}) => [x, y, z]);
      for (let i = 0; i < 50; i++) adapter.controller.estimator.estimate(landmarks);
      normal = live.size;
      opencv.solvePnP = () => { throw new Error('controlled solve failure'); };
      try { adapter.controller.estimator.estimate(landmarks); } catch { failed = live.size; }
    } finally {
      opencv.Mat = Mat; opencv.matFromArray = matFromArray; Mat.prototype.delete = remove; Mat.prototype.inv = inverse; opencv.solvePnP = solve;
    }
    return {normal, failed};
  });
  expect(result).toEqual({normal: 0, failed: 0});
});

test('cancel during a late camera result releases its tracks before restart', async ({page}) => {
  await page.addInitScript(() => { window.__fixtureConfig = {cameraGate: true}; });
  await page.goto('/');
  await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__fixture?.releaseCamera))).toBe(true);
  await page.getByRole('button', {name: 'Stop camera', exact: true}).click();
  await page.evaluate(() => { window.__fixture.cameraGate = false; window.__fixture.releaseCamera(); });
  await expect(page.getByRole('button', {name: 'Start camera', exact: true})).toBeEnabled();
  expect(await page.evaluate(() => window.__fixture.streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')))).toBe(true);
  expect(await page.evaluate(() => window.__fixture.modelLoads)).toBe(0);
  await start(page);
});

test('cancel during model initialization preserves a reusable model with no stale processing', async ({page}) => {
  await page.addInitScript(() => { window.__fixtureConfig = {modelGate: true}; });
  await page.goto('/'); await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__fixture?.releaseModel))).toBe(true);
  await page.getByRole('button', {name: 'Stop camera', exact: true}).click();
  await page.evaluate(() => window.__fixture.releaseModel());
  await expect(page.getByRole('button', {name: 'Start camera', exact: true})).toBeEnabled();
  expect(await page.evaluate(() => window.__fixture.frames)).toBe(0);
  await start(page);
  expect(await page.evaluate(() => window.__fixture.modelLoads)).toBe(1);
});

test('stale detection cannot revive a stopped loop or overwrite face loss', async ({page}) => {
  await page.goto('/'); await start(page);
  await page.evaluate(() => { window.__fixture.pauseNextDetect = true; });
  await expect.poll(() => page.evaluate(() => Boolean(window.__fixture?.releaseDetection))).toBe(true);
  await page.evaluate(() => {
    const f = window.__fixture; f.face = false;
    f.adapter.controller.stopProcessVideo(); f.adapter.controller.processVideo(f.adapter.video);
  });
  await expect(page.locator('#camera-label')).toHaveText('Camera ready');
  await page.evaluate(() => window.__fixture.releaseDetection());
  await page.waitForTimeout(60);
  expect(await page.evaluate(() => window.__fixture.adapter.getLatestEstimate())).toBeNull();
  await expect(page.locator('#camera-label')).toHaveText('Camera ready');
});

test('model and inference failures recover on restart', async ({page}) => {
  await page.addInitScript(() => { window.__fixtureConfig = {failModel: true}; });
  await page.goto('/'); await page.getByRole('button', {name: 'Start camera', exact: true}).click();
  await expect(page.locator('#status-message')).toContainText('model/WASM');
  await page.evaluate(() => { window.__fixture.failModel = false; }); await start(page);
  await page.evaluate(() => { window.__fixture.failInference = true; });
  await expect(page.locator('#status-message')).toContainText('Face tracking stopped');
  await expect(page.locator('#camera-stage video')).toHaveCount(0);
  await page.evaluate(() => { window.__fixture.failInference = false; }); await start(page);
  expect(await page.evaluate(() => window.__fixture.modelLoads)).toBe(2);
});
