import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group, Mesh, BoxGeometry, MeshBasicMaterial} from 'three';
import {EffectManager} from '../effect-manager.js';
import {Resources} from '../resources.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
function handle(scene) {
  const resources = new Resources();
  const geometry = resources.own(new BoxGeometry());
  const material = resources.own(new MeshBasicMaterial());
  resources.attach(scene, new Mesh(geometry, material));
  return resources;
}

test('a slow old load cannot replace the latest selection; loaded handles are reused', async () => {
  const scene = new Group(), loads = new Map(), records = new Map();
  const manager = new EffectManager({load: ({id}) => {
    const item = deferred(); loads.set(id, item); return item.promise;
  }});
  manager.setSelections({eyewear: 'round-glasses'}); await flush();
  manager.setSelections({eyewear: 'pixel-shades', stickers: 'star-cheeks'}); await flush();
  for (const id of ['pixel-shades', 'star-cheeks', 'round-glasses']) {
    const resource = handle(scene); records.set(id, resource); loads.get(id).resolve(resource); await flush();
  }
  assert.equal(records.get('round-glasses').roots[0].visible, false);
  assert.equal(records.get('pixel-shades').roots[0].visible, true);
  assert.equal(records.get('star-cheeks').roots[0].visible, true);
  manager.setSelections({eyewear: 'round-glasses', stickers: 'star-cheeks'}); await flush();
  assert.equal(records.get('pixel-shades').roots[0].visible, false);
  assert.equal(records.get('round-glasses').roots[0].visible, true);
  assert.equal(loads.size, 3);
  manager.dispose(); assert.equal(scene.children.length, 0);
});

test('a failed effect can retry without changing other categories', async () => {
  const scene = new Group(); let failures = 1;
  const manager = new EffectManager({load: ({id}) => {
    if (id === 'crown' && failures-- > 0) throw new Error('controlled failure');
    return handle(scene);
  }});
  manager.setSelections({headwear: 'crown', eyewear: 'round-glasses'}); await flush();
  assert.equal(manager.status.headwear.phase, 'error'); assert.equal(manager.status.eyewear.phase, 'ready');
  const glasses = manager.cache.get('round-glasses').handle.roots[0];
  manager.retry('crown'); await flush();
  assert.equal(manager.status.headwear.phase, 'ready'); assert.equal(glasses.visible, true);
  manager.dispose();
});

test('clear during load prevents attachment; teardown disposes late resources and shared parts once', async () => {
  const scene = new Group(), loading = deferred();
  const manager = new EffectManager({load: () => loading.promise});
  manager.setSelections({headwear: 'crown'}); await flush();
  manager.setSelections({}); manager.dispose();
  const resources = handle(scene), geometry = [...resources.items][0];
  let releases = 0; geometry.addEventListener('dispose', () => releases++);
  resources.own(geometry); // Same geometry can be owned by several mesh parts.
  loading.resolve(resources); await flush();
  assert.equal(scene.children.length, 0); assert.equal(resources.items.size, 0); assert.equal(releases, 1);
  resources.dispose(); assert.equal(releases, 1);
});
