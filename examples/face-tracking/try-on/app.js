import './style.css';
import {CATEGORIES, EFFECTS, getEffect, SelectionStore} from './catalog.js';
import {EffectManager} from './effect-manager.js';
import {CameraSession} from './session.js';

const $ = (id) => document.getElementById(id);
const store = new SelectionStore();
let category = 'face', manager, effectStatus = {}, destroyed = false;

const tabs = CATEGORIES.map((item, index) => {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'category-tab';
  button.textContent = item.label; button.id = `tab-${item.id}`;
  button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'effect-panel');
  button.addEventListener('click', () => selectCategory(item.id));
  button.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % CATEGORIES.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = CATEGORIES.length - 1;
    selectCategory(CATEGORIES[next].id); tabs[next].focus();
  });
  $('category-tabs').append(button);
  return button;
});

function selectCategory(id) {
  category = id;
  const info = CATEGORIES.find((item) => item.id === id);
  $('category-title').textContent = info.label;
  $('category-hint').textContent = info.hint;
  $('effect-panel').setAttribute('aria-labelledby', `tab-${id}`);
  $('effect-list').replaceChildren();
  EFFECTS.filter((effect) => effect.category === id).forEach((effect) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'effect-card'; button.dataset.effect = effect.id;
    button.setAttribute('aria-label', effect.label);
    const image = document.createElement('img'); image.src = effect.thumbnail; image.alt = ''; image.width = 160; image.height = 140;
    const name = document.createElement('span'); name.className = 'effect-name'; name.textContent = effect.label;
    const state = document.createElement('span'); state.className = 'effect-state';
    const check = document.createElement('span'); check.className = 'selected-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
    button.append(image, name, state, check);
    button.addEventListener('click', () => store.toggle(effect.id));
    $('effect-list').append(button);
  });
  renderSelection();
}

function renderSelection() {
  tabs.forEach((tab, index) => {
    const id = CATEGORIES[index].id;
    tab.setAttribute('aria-selected', String(id === category));
    tab.tabIndex = id === category ? 0 : -1;
    tab.classList.toggle('has-selection', Boolean(store.selected[id]));
  });
  document.querySelectorAll('.effect-card').forEach((button) => {
    const effect = getEffect(button.dataset.effect), selected = store.selected[effect.category] === effect.id;
    const status = effectStatus[effect.category];
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-busy', String(selected && status?.phase === 'loading'));
    button.querySelector('.selected-check').hidden = !selected;
    button.querySelector('.effect-state').textContent = !selected ? 'Tap to try' : status?.phase === 'loading' ? 'Loading…' : status?.phase === 'error' ? 'Could not load' : 'Selected';
  });
  const ids = CATEGORIES.map(({id}) => store.selected[id]).filter(Boolean);
  $('selection-count').textContent = `${ids.length} / 5`;
  $('clear-all').disabled = ids.length === 0;
  // Preserve the focused removal control when status changes, or move focus to
  // the next chip when a chip is removed. Never lose keyboard focus to <body>.
  const focused = document.activeElement?.dataset.remove;
  $('selected-look').replaceChildren();
  if (!ids.length) {
    const empty = document.createElement('p'); empty.className = 'empty-look';
    empty.textContent = 'A blank canvas, for now. Choose one effect from each category.';
    $('selected-look').append(empty);
  }
  ids.forEach((id) => {
    const effect = getEffect(id), chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'look-chip'; chip.dataset.remove = id;
    chip.setAttribute('aria-label', `Remove ${effect.label}`);
    const label = document.createElement('span'); label.textContent = effect.label;
    const close = document.createElement('b'); close.textContent = '×'; close.setAttribute('aria-hidden', 'true');
    chip.append(label, close); chip.addEventListener('click', () => store.toggle(id));
    $('selected-look').append(chip);
  });
  if (focused) (document.querySelector(`[data-remove="${focused}"]`) || $('selected-look').querySelector('button') || tabs[CATEGORIES.findIndex(({id}) => id === category)]).focus();
  $('effect-feedback').textContent = ids.length && !manager ? 'Your look is selected. Start the camera to see it.' : ids.length ? 'One effect per category. Your other choices stay on.' : '';
  const retryFocus = document.activeElement?.dataset.retry;
  $('effect-errors').replaceChildren();
  Object.values(effectStatus).filter(({phase}) => phase === 'error').forEach(({id}) => {
    const error = document.createElement('p'); error.textContent = `${getEffect(id).label} could not load. Your camera and other effects keep working.`;
    const retry = document.createElement('button'); retry.type = 'button'; retry.dataset.retry = id; retry.textContent = `Retry ${getEffect(id).label}`;
    retry.addEventListener('click', () => manager?.retry(id)); error.append(retry); $('effect-errors').append(error);
  });
  if (retryFocus) (document.querySelector(`[data-retry="${retryFocus}"]`) || tabs[CATEGORIES.findIndex(({id}) => id === category)]).focus();
}

const labels = {idle: 'Camera off', loading: 'Preparing preview', permission: 'Waiting for permission', searching: 'Camera ready', tracking: 'Face found', error: 'Camera needs attention', stopping: 'Stopping'};
const session = new CameraSession({
  onChange: ({phase, message}) => {
    $('stage').dataset.phase = phase;
    $('camera-label').textContent = labels[phase];
    const live = ['searching', 'tracking'].includes(phase);
    $('placeholder').hidden = live;
    $('tracking-hint').hidden = phase !== 'searching';
    $('camera-toggle').disabled = phase === 'stopping';
    $('camera-button-label').textContent = ['idle', 'error'].includes(phase) ? 'Start camera' : phase === 'stopping' ? 'Stopping…' : 'Stop camera';
    const idle = phase === 'idle';
    $('placeholder-title').textContent = idle ? 'Come as you are.' : phase === 'error' ? 'Let’s get you back in.' : phase === 'permission' ? 'Your camera, your call.' : 'Getting things ready…';
    $('placeholder-text').textContent = message || (idle ? 'Your camera starts when you say so. Browse a look, then jump in.' : 'Finishing the camera request. If a browser prompt is open, dismiss it.');
    $('status-message').textContent = message || (phase === 'tracking' ? 'Effects follow your face. Mix a new look below.' : phase === 'searching' ? 'Camera is ready. Bring one face into view.' : phase === 'idle' ? 'Camera stays off until you start it.' : 'Finishing the camera request…');
  },
  create: async (callbacks) => {
    const [{MindARThree}, {createEffect, createOccluder}] = await Promise.all([
      import('../../../src/face-target/three.js'), import('./effects.js'),
    ]);
    const adapter = new MindARThree({container: $('camera-stage'), uiLoading: 'no', uiScanning: 'no', uiError: 'no', maxPixelRatio: 2, onCameraReady: callbacks.onCameraReady, onFaceUpdate: callbacks.onFaceUpdate});
    adapter.controller.onError = callbacks.onError;
    const occluder = createOccluder(adapter), anchors = new Map();
    manager = new EffectManager({load: (effect) => createEffect(effect, {adapter, anchors}), onChange: (status) => { effectStatus = status; if (!destroyed) renderSelection(); }});
    manager.setSelections(store.selected);
    const observer = new ResizeObserver(() => adapter._resize());
    observer.observe($('camera-stage'));
    return {
      start: () => adapter.start(), stop: () => adapter.stop(),
      render: () => adapter.renderer.setAnimationLoop(() => adapter.renderer.render(adapter.scene, adapter.camera)),
      dispose: async () => { observer.disconnect(); manager.dispose(); occluder.dispose(); await adapter.dispose(); },
    };
  },
});

const unsubscribe = store.subscribe((selected) => { manager?.setSelections(selected); renderSelection(); });
$('clear-all').addEventListener('click', () => { store.clear(); tabs[CATEGORIES.findIndex(({id}) => id === category)].focus(); });
$('camera-toggle').addEventListener('click', () => {
  if (['idle', 'error'].includes(session.state.phase)) session.start(); else session.stop();
});
$('privacy-link').addEventListener('click', () => { $('about').open = true; });
function background() { if (document.hidden) session.stop(); }
function pagehide(event) { if (event.persisted) session.stop(); else destroy(); }
async function destroy() {
  if (destroyed) return;
  destroyed = true; unsubscribe();
  document.removeEventListener('visibilitychange', background);
  window.removeEventListener('pagehide', pagehide);
  await session.dispose();
}
document.addEventListener('visibilitychange', background);
window.addEventListener('pagehide', pagehide);
selectCategory(category);
