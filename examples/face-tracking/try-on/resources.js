// Own GPU resources explicitly; sets prevent double disposal of shared parts.
export class Resources {
  constructor() {
    this.items = new Set();
    this.roots = [];
    this.cleanups = [];
    this.disposed = false;
  }
  own(item) { this.items.add(item); return item; }
  attach(parent, root) {
    root.visible = false;
    parent.add(root);
    this.roots.push(root);
    return root;
  }
  setActive(active) { this.roots.forEach((root) => { root.visible = active; }); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.roots.forEach((root) => root.removeFromParent());
    this.cleanups.forEach((cleanup) => cleanup());
    this.items.forEach((item) => item.dispose());
    this.roots = [];
    this.cleanups = [];
    this.items.clear();
  }
}
