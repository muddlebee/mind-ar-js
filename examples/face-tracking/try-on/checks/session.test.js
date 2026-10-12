import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraSession, cameraError} from '../session.js';

function fixture() {
  const tracks = new Set(), loops = new Set(), history = [];
  let callbacks, disposed = false;
  const session = new CameraSession({check: () => {}, onChange: (state) => history.push(state), create: async (hooks) => {
    callbacks = hooks;
    return {
      async start() { tracks.add({}); callbacks.onCameraReady(); },
      stop() { tracks.clear(); loops.clear(); }, render() { loops.add('render'); },
      async dispose() { disposed = true; },
    };
  }});
  return {session, tracks, loops, history, hooks: () => callbacks, disposed: () => disposed};
}

test('ten start/stop cycles retain one loop, release ownership, and report face loss/reacquisition', async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    await f.session.start(); assert.equal(f.tracks.size, 1); assert.equal(f.loops.size, 1);
    assert.equal(f.session.state.phase, 'searching');
    f.hooks().onFaceUpdate({hasFace: true}); assert.equal(f.session.state.phase, 'tracking');
    f.hooks().onFaceUpdate({hasFace: false}); assert.equal(f.session.state.phase, 'searching');
    f.session.stop(); assert.equal(f.tracks.size, 0); assert.equal(f.loops.size, 0);
  }
  assert.equal(f.history.filter(({message}) => message === 'Camera ready. Loading face tracking…').length, 10);
  await f.session.dispose(); assert.equal(f.disposed(), true);
});

test('permission failure leaves a recoverable error state', async () => {
  const session = new CameraSession({check: () => { throw new DOMException('denied', 'NotAllowedError'); }, onChange: () => {}, create: () => { throw new Error('should not initialize'); }});
  await session.start(); assert.equal(session.state.phase, 'error'); assert.match(session.state.message, /site settings/);
  assert.equal(session.startTask, null);
  assert.match(cameraError(new Error('download failed'), 'loading'), /model\/WASM/);
});

test('stop during pending engine creation cannot start or render a stale camera', async () => {
  let resolve; const pending = new Promise((done) => { resolve = done; });
  const tracks = new Set();
  const session = new CameraSession({check: () => {}, onChange: () => {}, create: () => pending});
  const start = session.start(); await Promise.resolve(); session.stop(); assert.equal(session.state.phase, 'stopping');
  resolve({start() { tracks.add('unexpected'); }, stop() {}, render() { tracks.add('unexpected loop'); }, dispose() { tracks.clear(); }});
  await start; assert.equal(tracks.size, 0); assert.equal(session.state.phase, 'idle');
  await session.dispose();
});

test('concurrent start calls share the same task', async () => {
  const f = fixture(); const first = f.session.start(), second = f.session.start();
  assert.equal(first, second); await first; assert.equal(f.tracks.size, 1);
  await f.session.dispose();
});
