import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES, EFFECTS, getEffect, SelectionStore} from '../catalog.js';

test('catalog contains two original effects in each of five categories', () => {
  assert.equal(EFFECTS.length, 10);
  assert.equal(new Set(EFFECTS.map(({id}) => id)).size, 10);
  for (const category of CATEGORIES) assert.equal(EFFECTS.filter((effect) => effect.category === category.id).length, 2);
  for (const effect of EFFECTS) {
    assert.match(effect.thumbnail, new RegExp(`${effect.id}\\.svg$`));
    assert.equal(effect.assets.length, 0);
    assert.match(effect.credits, /MIT/);
  }
});

test('mixing, category replacement, toggle removal, and Clear all preserve isolation', () => {
  const state = new SelectionStore();
  state.toggle('star-cheeks'); state.toggle('round-glasses'); state.toggle('color-pop');
  assert.deepEqual(state.selected, {stickers: 'star-cheeks', eyewear: 'round-glasses', face: 'color-pop'});
  state.toggle('carnival-mask');
  assert.deepEqual(state.selected, {stickers: 'star-cheeks', eyewear: 'round-glasses', face: 'carnival-mask'});
  state.toggle('round-glasses'); assert.equal(state.selected.eyewear, undefined);
  state.clear(); assert.deepEqual(state.selected, {});
});

test('invalid IDs leave selection unchanged; snapshots cannot be mutated', () => {
  const state = new SelectionStore(); state.toggle('crown');
  const snapshot = state.selected;
  assert.throws(() => state.toggle('missing'), RangeError);
  assert.throws(() => getEffect('__proto__'), RangeError);
  assert.equal(state.selected, snapshot);
  assert.throws(() => { snapshot.headwear = 'bad'; }, TypeError);
});

test('subscribers receive immutable state and unsubscribe', () => {
  const state = new SelectionStore(), received = [];
  const unsubscribe = state.subscribe((selected) => received.push(selected));
  state.toggle('hoops'); unsubscribe(); state.clear();
  assert.equal(received.length, 2); assert.deepEqual(received[1], {earrings: 'hoops'});
});
