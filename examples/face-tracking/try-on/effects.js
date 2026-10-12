import * as THREE from 'three';
import {uvs} from '../../../src/face-target/face-geometry/face-data.js';
import {Resources} from './resources.js';

function star(context, x, y, radius, fill, rotation = -Math.PI / 2) {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = rotation + i * Math.PI / 5;
    const r = radius * (i % 2 ? 0.45 : 1);
    const point = [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
    if (i === 0) context.moveTo(...point); else context.lineTo(...point);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function texture(resources, draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This effect needs a 2D canvas.');
  draw(context, size);
  const map = resources.own(new THREE.CanvasTexture(canvas));
  map.encoding = THREE.sRGBEncoding;
  return map;
}

function faceTexture(resources, kind) {
  return texture(resources, (ctx, size) => {
    // Face UV coordinates have v pointing up. Canvas y points down.
    const point = (index) => [uvs[index][0] * size, (1 - uvs[index][1]) * size];
    if (kind === 'paint') {
      for (const [index, color, angle] of [[50, '#f5749ca8', -0.25], [280, '#55cbbb9c', 0.25]]) {
        const [x, y] = point(index);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.085, size * 0.044, angle, 0, Math.PI * 2);
        ctx.fill();
        star(ctx, x, y, size * 0.033, '#fff2be');
      }
      const [x, y] = point(151);
      star(ctx, x, y, size * 0.055, '#ffc857b0');
      ctx.fillStyle = '#8967d9a0';
      for (const index of [67, 297]) {
        const [dx, dy] = point(index);
        ctx.beginPath(); ctx.arc(dx, dy, size * 0.016, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const left = [33, 160, 158, 133, 153, 144];
      const right = [263, 387, 385, 362, 380, 373];
      const center = (indices) => indices.map(point).reduce(([x, y], [px, py]) => [x + px / indices.length, y + py / indices.length], [0, 0]);
      const a = center(left), b = center(right);
      const gradient = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      gradient.addColorStop(0, '#895ad6e6'); gradient.addColorStop(1, '#da69bfe6');
      ctx.fillStyle = gradient;
      for (const [x, y] of [a, b]) {
        ctx.beginPath(); ctx.ellipse(x, y, size * 0.15, size * 0.084, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillRect(Math.min(a[0], b[0]), (a[1] + b[1]) / 2 - size * 0.036, Math.abs(a[0] - b[0]), size * 0.062);
      ctx.globalCompositeOperation = 'destination-out';
      for (const indices of [left, right]) {
        const [cx, cy] = center(indices);
        ctx.beginPath();
        indices.forEach((index, i) => {
          const [px, py] = point(index);
          const x = cx + (px - cx) * 1.18, y = cy + (py - cy) * 1.7;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      star(ctx, a[0] - size * 0.1, a[1] - size * 0.045, size * 0.025, '#ffe7a3');
      star(ctx, b[0] + size * 0.1, b[1] - size * 0.045, size * 0.025, '#ffe7a3');
    }
  }, 1024);
}

export function createOccluder(adapter) {
  const resources = new Resources();
  const mesh = adapter.addFaceMesh();
  mesh.material.dispose();
  mesh.material = resources.own(new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: true, side: THREE.DoubleSide}));
  resources.own(mesh.geometry);
  mesh.renderOrder = -1;
  adapter.scene.add(mesh);
  resources.roots.push(mesh);
  resources.cleanups.push(() => unregisterFaceMesh(adapter, mesh));
  return resources;
}

function unregisterFaceMesh(adapter, mesh) {
  adapter.faceMeshes = adapter.faceMeshes.filter((item) => item !== mesh);
  adapter.controller.customFaceGeometries = adapter.controller.customFaceGeometries.filter((item) => item !== mesh.geometry);
}

export function createEffect(effect, {adapter, anchors}) {
  const resources = new Resources();
  const mesh = (geometry, material, parent, position = [0, 0, 0]) => {
    const object = new THREE.Mesh(resources.own(geometry), material);
    object.position.set(...position);
    parent.add(object);
    return object;
  };
  const material = (color, extra = {}) => resources.own(new THREE.MeshBasicMaterial({color, ...extra}));
  const torus = (radius, tube) => new THREE.TorusGeometry(radius, tube, 8, 32);
  try {
    if (effect.category === 'face') {
      const surface = adapter.addFaceMesh();
      surface.material.dispose();
      resources.own(surface.geometry);
      resources.cleanups.push(() => unregisterFaceMesh(adapter, surface));
      surface.material = material('#ffffff', {
        map: faceTexture(resources, effect.kind), transparent: true, depthWrite: false,
        side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      surface.renderOrder = 1;
      const root = resources.attach(adapter.scene, new THREE.Group());
      root.add(surface);
      return resources;
    }
    effect.placement.anchors.forEach((index, side) => {
      if (!anchors.has(index)) anchors.set(index, adapter.addAnchor(index));
      const root = resources.attach(anchors.get(index).group, new THREE.Group());
      root.position.set(...effect.placement.offset);
      const main = material(effect.color);
      if (effect.category === 'stickers') {
        const map = texture(resources, (ctx, size) => {
          if (effect.kind === 'stars') {
            star(ctx, size * 0.5, size * 0.5, size * 0.4, effect.color);
            // Deliberately asymmetric: a small teal satellite only on one cheek.
            if (side === 0) star(ctx, size * 0.85, size * 0.16, size * 0.12, '#469b92');
          } else {
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.moveTo(size * 0.5, size * 0.87);
            ctx.bezierCurveTo(0, size * 0.55, size * 0.02, size * 0.1, size * 0.3, size * 0.13);
            ctx.bezierCurveTo(size * 0.43, size * 0.13, size * 0.5, size * 0.25, size * 0.5, size * 0.3);
            ctx.bezierCurveTo(size * 0.6, 0, size, size * 0.1, size * 0.9, size * 0.5);
            ctx.bezierCurveTo(size * 0.85, size * 0.65, size * 0.65, size * 0.77, size * 0.5, size * 0.87);
            ctx.fill();
          }
        }, 256);
        const size = effect.placement.size * (side === 1 ? 0.82 : 1);
        const sticker = mesh(new THREE.PlaneGeometry(size, size), material('#ffffff', {map, transparent: true, depthWrite: false, side: THREE.DoubleSide}), root);
        sticker.rotation.z = side === 0 ? -0.16 : 0.22;
      } else if (effect.kind === 'round') {
        const lens = material('#c6eceb', {transparent: true, opacity: 0.22, depthWrite: false});
        for (const x of [-0.19, 0.19]) {
          mesh(torus(0.15, 0.014), main, root, [x, 0, 0]);
          mesh(new THREE.CircleGeometry(0.136, 32), lens, root, [x, 0, -0.004]);
          mesh(new THREE.BoxGeometry(0.012, 0.015, 0.24), main, root, [x < 0 ? -0.34 : 0.34, 0.02, -0.12]);
        }
        mesh(new THREE.BoxGeometry(0.09, 0.015, 0.015), main, root, [0, 0.026, 0]);
      } else if (effect.kind === 'pixel') {
        const dark = material('#252332');
        const shine = material('#b9e9df');
        for (const x of [-0.18, 0.18]) {
          mesh(new THREE.BoxGeometry(0.32, 0.18, 0.035), dark, root, [x, -0.012, 0]);
          mesh(new THREE.BoxGeometry(0.26, 0.023, 0.01), main, root, [x, 0.084, 0.023]);
          mesh(new THREE.BoxGeometry(0.014, 0.018, 0.25), dark, root, [x < 0 ? -0.34 : 0.34, 0.06, -0.11]);
          for (let p = 0; p < 3; p++) mesh(new THREE.BoxGeometry(0.033, 0.033, 0.008), shine, root, [x - 0.045 + p * 0.034, 0.035 - p * 0.026, 0.024]);
        }
        mesh(new THREE.BoxGeometry(0.055, 0.035, 0.025), dark, root, [0, 0.025, 0]);
      } else if (effect.kind === 'crown') {
        const band = mesh(torus(0.275, 0.027), main, root, [0, 0.03, 0]);
        band.rotation.x = Math.PI / 2;
        const gem = material('#d477a0');
        for (let i = 0; i < 7; i++) {
          const angle = i * Math.PI * 2 / 7;
          const x = Math.sin(angle) * 0.26, z = Math.cos(angle) * 0.26;
          mesh(new THREE.ConeGeometry(0.055, 0.21, 4), main, root, [x, 0.12, z]);
          mesh(new THREE.SphereGeometry(0.023, 10, 8), gem, root, [x, 0.24, z]);
        }
      } else if (effect.kind === 'hat') {
        mesh(new THREE.ConeGeometry(0.255, 0.48, 24), main, root, [0, 0.24, 0]);
        const brim = mesh(torus(0.255, 0.015), material('#ffdc80'), root);
        brim.rotation.x = Math.PI / 2;
        mesh(new THREE.SphereGeometry(0.05, 12, 8), material('#57baab'), root, [0, 0.5, 0]);
        const dot = material('#fff0ce');
        for (let i = 0; i < 9; i++) {
          const y = 0.07 + (i % 3) * 0.115;
          const radius = 0.255 * (1 - y / 0.48);
          const angle = i * 2.4;
          mesh(new THREE.SphereGeometry(0.018, 8, 6), dot, root, [Math.sin(angle) * radius, y, Math.cos(angle) * radius]);
        }
      } else {
        root.position.x += side === 0 ? -0.035 : 0.035;
        mesh(new THREE.SphereGeometry(0.02, 12, 8), material('#efd481'), root);
        if (effect.kind === 'hoops') {
          mesh(torus(0.082, 0.013), main, root, [0, -0.082, 0]);
        } else {
          mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), material('#efd481'), root, [0, -0.06, 0]);
          const drop = mesh(new THREE.OctahedronGeometry(0.057), main, root, [0, -0.14, 0]);
          drop.scale.y = 1.5;
        }
      }
    });
    return resources;
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
