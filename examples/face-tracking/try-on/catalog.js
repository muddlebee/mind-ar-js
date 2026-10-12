// This is the example's internal catalog, not an effect-file format or public SDK.
export const CATEGORIES = Object.freeze([
  {id: 'face', label: 'Face', hint: 'A little color, a whole new mood.'},
  {id: 'stickers', label: 'Stickers', hint: 'Small shapes. Big personality.'},
  {id: 'eyewear', label: 'Eyewear', hint: 'See yourself in something new.'},
  {id: 'headwear', label: 'Headwear', hint: 'The finishing touch, up top.'},
  {id: 'earrings', label: 'Earrings', hint: 'A little extra on both sides.'},
].map(Object.freeze));

const original = 'Original procedural artwork and geometry, MIT; see Credits.';
const entry = (id, category, label, kind, color, placement = {}) => Object.freeze({
  id, category, label, kind, color, placement: Object.freeze(placement),
  thumbnail: new URL(`./assets/${id}.svg`, import.meta.url).href,
  credits: original,
  assets: Object.freeze([]), // No third-party models. Geometry/textures are created on demand.
});

export const EFFECTS = Object.freeze([
  entry('color-pop', 'face', 'Color-pop paint', 'paint', '#f26b98'),
  entry('carnival-mask', 'face', 'Carnival mask', 'mask', '#7762c6'),
  entry('star-cheeks', 'stickers', 'Star cheeks', 'stars', '#f3bb4d', {anchors: [50, 280], size: 0.13, offset: [0, 0, 0.025]}),
  entry('heart-cheeks', 'stickers', 'Heart cheeks', 'hearts', '#ec7294', {anchors: [50, 280], size: 0.13, offset: [0, 0, 0.025]}),
  entry('round-glasses', 'eyewear', 'Round glasses', 'round', '#e89a49', {anchors: [168], offset: [0, 0, 0.075]}),
  entry('pixel-shades', 'eyewear', 'Pixel shades', 'pixel', '#6f62bf', {anchors: [168], offset: [0, 0, 0.075]}),
  entry('crown', 'headwear', 'Crown', 'crown', '#efb848', {anchors: [10], offset: [0, 0.04, -0.055]}),
  entry('party-hat', 'headwear', 'Party hat', 'hat', '#e878a2', {anchors: [10], offset: [0, 0.04, -0.055]}),
  entry('hoops', 'earrings', 'Hoops', 'hoops', '#e7b144', {anchors: [127, 356], offset: [0, -0.18, 0]}),
  entry('drop-earrings', 'earrings', 'Drop earrings', 'drops', '#59a99d', {anchors: [127, 356], offset: [0, -0.18, 0]}),
]);

const byId = new Map(EFFECTS.map((effect) => [effect.id, effect]));
export function getEffect(id) {
  const effect = byId.get(id);
  if (!effect) throw new RangeError(`Unknown effect: ${id}`);
  return effect;
}

export class SelectionStore {
  constructor() {
    this.selected = Object.freeze({});
    this.listeners = new Set();
  }
  toggle(id) {
    const effect = getEffect(id);
    const next = {...this.selected};
    if (next[effect.category] === id) delete next[effect.category];
    else next[effect.category] = id;
    this.selected = Object.freeze(next);
    this.emit();
  }
  clear() {
    this.selected = Object.freeze({});
    this.emit();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.selected);
    return () => this.listeners.delete(listener);
  }
  emit() { this.listeners.forEach((listener) => listener(this.selected)); }
}
