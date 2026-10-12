import {CATEGORIES, getEffect} from './catalog.js';

// Each cached handle owns its resources until teardown. Only the newest request
// in a category can activate it; a slow previous request can never replace it.
export class EffectManager {
  constructor({load, onChange = () => {}}) {
    this.load = load;
    this.onChange = onChange;
    this.cache = new Map();
    this.selected = {};
    this.status = {};
    this.revisions = new Map();
    this.disposed = false;
  }
  setSelections(selected) {
    if (this.disposed) return;
    for (const {id: category} of CATEGORIES) {
      if (this.selected[category] === selected[category]) continue;
      this.selected[category] = selected[category];
      this.updateCategory(category);
    }
  }
  retry(id) {
    const effect = getEffect(id);
    if (this.selected[effect.category] === id && !this.disposed) this.updateCategory(effect.category);
  }
  async updateCategory(category) {
    const revision = (this.revisions.get(category) || 0) + 1;
    this.revisions.set(category, revision);
    for (const item of this.cache.values()) {
      if (item.effect.category === category) item.handle?.setActive(false);
    }
    const id = this.selected[category];
    if (!id) {
      delete this.status[category];
      this.emit();
      return;
    }
    this.status[category] = {id, phase: 'loading'};
    this.emit();
    const effect = getEffect(id);
    let item = this.cache.get(id);
    if (!item) {
      item = {effect};
      this.cache.set(id, item);
      item.promise = Promise.resolve().then(() => this.load(effect)).then((handle) => {
        if (this.disposed) { handle.dispose(); return null; }
        item.handle = handle;
        handle.setActive(false);
        return handle;
      }).catch((error) => {
        if (this.cache.get(id) === item) this.cache.delete(id);
        throw error;
      });
    }
    try {
      const handle = await item.promise;
      if (this.disposed || this.revisions.get(category) !== revision) return;
      handle.setActive(true);
      this.status[category] = {id, phase: 'ready'};
    } catch (error) {
      if (this.disposed || this.revisions.get(category) !== revision) return;
      this.status[category] = {id, phase: 'error', message: error.message};
    }
    this.emit();
  }
  emit() { if (!this.disposed) this.onChange({...this.status}); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cache.forEach((item) => item.handle?.dispose());
    this.cache.clear();
  }
}
