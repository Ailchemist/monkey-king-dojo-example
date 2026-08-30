import * as THREE from 'three';
import type { DojoRuntime } from './createDojoModel';
import { EXTERNAL_LINKS, FACADE_NAVIGATION } from './signage.ts';
export { PILLAR_DESTINATIONS } from './signage.ts';

export const CHANNELS = Object.values(EXTERNAL_LINKS);

export function hoverValue(from: number, to: number, progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  if (t === 0) return from;
  if (t === 1) return to;
  const shift = t - 1;
  const ease = to > from ? 1 + 2.05 * shift ** 3 + 1.05 * shift ** 2 : 1 - (1 - t) ** 3;
  return THREE.MathUtils.lerp(from, to, ease);
}

/** Scale around the ink's center, not the facade's origin. */
export function createLogoMotion(part: THREE.Group) {
  part.updateWorldMatrix(true, true);
  const initialBounds = new THREE.Box3().setFromObject(part);
  const center = part.worldToLocal(initialBounds.getCenter(new THREE.Vector3()));
  const position = part.position.clone(), rotation = part.quaternion.clone(), scale = part.scale.clone();
  const restCenter = center.clone().multiply(scale).applyQuaternion(rotation).add(position);
  const pillar = part.userData.navType === 'pillar';
  const warmHighlight = new THREE.Color('#c8884e');
  const colors = new Map<THREE.MeshBasicMaterial | THREE.MeshStandardMaterial, { color: THREE.Color; emissive?: THREE.Color; intensity: number }>();
  part.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial) colors.set(material, {
        color: material.color.clone(),
        emissive: material instanceof THREE.MeshStandardMaterial ? material.emissive.clone() : undefined,
        intensity: material instanceof THREE.MeshStandardMaterial ? material.emissiveIntensity : 0,
      });
    }
  });
  const offset = new THREE.Vector3(), turn = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
  const reset = () => {
    part.position.copy(position);
    part.quaternion.copy(rotation);
    part.scale.copy(scale);
    colors.forEach((saved, material) => {
      material.color.copy(saved.color);
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive.copy(saved.emissive!);
        material.emissiveIntensity = saved.intensity;
      }
    });
    part.updateWorldMatrix(false, true);
  };
  return {
    get bounds() {
      part.updateWorldMatrix(true, true);
      return new THREE.Box3().setFromObject(part);
    },
    reset,
    apply(amount: number, reducedMotion = false) {
      const level = THREE.MathUtils.clamp(amount, 0, 1.1);
      reset();
      if (level === 0) return;
      if (!reducedMotion) {
        part.scale.copy(scale).multiplyScalar(1 + (pillar ? .035 : .11) * level);
        turn.setFromAxisAngle(axis, (pillar ? 0 : -.018) * level);
        part.quaternion.copy(rotation).multiply(turn);
        offset.copy(center).multiply(part.scale).applyQuaternion(part.quaternion);
        part.position.copy(restCenter).sub(offset);
        // Door/window signs sit behind a transparent reflection coat. Moving
        // them toward the camera made them cross that coat during the first
        // animation frames, abruptly toggling the glass over their inner SVG
        // pieces. Scale/turn on the glass plane; only solid pillar lettering
        // needs physical depth travel.
        if (pillar) part.position.addScaledVector(axis, .045 * level);
      }
      colors.forEach((saved, material) => {
        if (pillar) material.color.copy(saved.color).lerp(warmHighlight, .25 * level);
        else material.color.copy(saved.color).multiplyScalar(1 + .25 * level);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.copy(saved.emissive!).lerp(warmHighlight, .45 * level);
          material.emissiveIntensity = saved.intensity + .2 * level;
        }
      });
      part.updateWorldMatrix(false, true);
    },
  };
}

/** A native link follows each logo through responsive camera changes. */
export function projectLogoBounds(box: THREE.Box3, camera: THREE.Camera, width: number, height: number, padding = 12, minTarget = 48) {
  const point = new THREE.Vector3();
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    point.set(x, y, z).project(camera);
    if (point.z < -1 || point.z > 1) return null;
    const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
    left = Math.min(left, px); right = Math.max(right, px);
    top = Math.min(top, py); bottom = Math.max(bottom, py);
  }
  if (right < 0 || left > width || bottom < 0 || top > height) return null;
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  const hitWidth = Math.min(width, Math.max(minTarget, right - left + padding * 2));
  const hitHeight = Math.min(height, Math.max(minTarget, bottom - top + padding * 2));
  return {
    left: Math.max(0, Math.min(width - hitWidth, centerX - hitWidth / 2)),
    top: Math.max(0, Math.min(height - hitHeight, centerY - hitHeight / 2)),
    width: hitWidth,
    height: hitHeight,
  };
}

/** Split free space between ink bounds, reserving at least 24px per target. */
function partition(ranges: { min: number; max: number }[], extent: number) {
  const boundaries = [0, ...ranges.slice(1).map((range, i) => (ranges[i].max + range.min) / 2), extent];
  for (let i = 1; i < ranges.length; i++) boundaries[i] = Math.min(ranges[i].min, Math.max(boundaries[i], boundaries[i - 1] + 24));
  for (let i = ranges.length - 1; i > 0; i--) boundaries[i] = Math.max(ranges[i - 1].max, Math.min(boundaries[i], boundaries[i + 1] - 24));
  return boundaries;
}

export function projectNavigationTargets(boxes: THREE.Box3[], camera: THREE.Camera, width: number, height: number, lanes: readonly string[] = boxes.map((_, i) => String(i)), hitAreas = boxes) {
  const targets = hitAreas.map(box => projectLogoBounds(box, camera, width, height));
  const ink = boxes.map((box, index) => ({ index, rect: projectLogoBounds(box, camera, width, height, 0, 0) }))
    .filter((entry): entry is { index: number; rect: NonNullable<typeof entry.rect> } => entry.rect !== null);
  const byLane = new Map<string, typeof ink>();
  ink.forEach(entry => {
    const lane = lanes[entry.index];
    const column = byLane.get(lane) ?? [];
    column.push(entry); byLane.set(lane, column);
  });
  const columns = [...byLane.values()].map(entries => ({
    entries: entries.sort((a, b) => a.rect.top - b.rect.top),
    min: Math.min(...entries.map(e => e.rect.left)),
    max: Math.max(...entries.map(e => e.rect.left + e.rect.width)),
  })).sort((a, b) => a.min - b.min);
  const horizontal = partition(columns, width);
  columns.forEach((column, col) => {
    const vertical = partition(column.entries.map(e => ({ min: e.rect.top, max: e.rect.top + e.rect.height })), height);
    column.entries.forEach((entry, row) => {
      const target = targets[entry.index];
      if (!target) return;
      const minX = horizontal[col], maxX = horizontal[col + 1], minY = vertical[row], maxY = vertical[row + 1];
      target.width = Math.min(target.width, maxX - minX);
      target.height = Math.min(target.height, maxY - minY);
      target.left = THREE.MathUtils.clamp(target.left, minX, maxX - target.width);
      target.top = THREE.MathUtils.clamp(target.top, minY, maxY - target.height);
    });
  });
  return targets;
}

export interface ChannelLinks { resize: () => void; reset: () => void; dispose: () => void }

export function createChannelLinks(host: HTMLElement, camera: THREE.Camera, runtime: DojoRuntime, render: () => void): ChannelLinks {
  const listeners = new AbortController();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const entries = FACADE_NAVIGATION.flatMap(item => {
    const part = runtime.parts.get(item.partId);
    if (!part) return [];
    const element = document.createElement('a');
    element.href = item.href;
    if (item.href.startsWith('https://')) {
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
    element.className = `channel-link${part.userData.navType === 'pillar' ? ' pillar-link' : ''}`;
    element.dataset.channel = item.id;
    element.dataset.state = 'idle';
    element.dataset.hoverAmount = '0';
    element.setAttribute('aria-label', item.label);
    if (part.userData.navType === 'pillar') {
      element.setAttribute('aria-haspopup', 'dialog');
      element.setAttribute('aria-controls', 'dojo-board');
    }
    element.style.setProperty('--brand', item.color);
    element.hidden = true;
    host.append(element);
    const motion = createLogoMotion(part);
    return [{ element, motion, lane: item.lane, hitArea: part.userData.hitArea instanceof THREE.Box3 ? part.userData.hitArea : undefined, value: 0, from: 0, target: 0, started: 0, moving: false, hovered: false, focused: false, touched: false }];
  });
  type Entry = typeof entries[number];
  let frame = 0;

  const drawEntry = (entry: Entry) => {
    entry.motion.apply(entry.value, reducedMotion.matches);
    entry.element.style.setProperty('--glow', String(.22 * entry.value));
    entry.element.dataset.hoverAmount = entry.value.toFixed(3);
    entry.element.dataset.state = entry.moving ? (entry.target ? 'entering' : 'leaving') : (entry.target ? 'hovered' : 'idle');
  };
  const tick = (now: number) => {
    frame = 0;
    let moving = false;
    for (const entry of entries) {
      if (!entry.moving) continue;
      const duration = entry.target ? 240 : 180;
      const progress = Math.min(1, (now - entry.started) / duration);
      entry.value = hoverValue(entry.from, entry.target, progress);
      entry.moving = progress < 1;
      moving ||= entry.moving;
      drawEntry(entry);
    }
    render();
    if (moving) frame = requestAnimationFrame(tick);
  };
  const update = (entry: Entry) => {
    const target = Number(entry.hovered || entry.focused || entry.touched);
    if (target === entry.target) return;
    entry.from = entry.value;
    entry.target = target;
    entry.started = performance.now();
    if (reducedMotion.matches) {
      entry.value = target;
      entry.moving = false;
      drawEntry(entry);
      render();
    } else {
      entry.moving = true;
      if (!frame) frame = requestAnimationFrame(tick);
    }
  };

  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const entry of entries) {
      Object.assign(entry, { value: 0, from: 0, target: 0, moving: false, hovered: false, focused: false, touched: false });
      entry.motion.reset();
      entry.element.dataset.state = 'idle';
      entry.element.dataset.hoverAmount = '0';
      entry.element.style.removeProperty('--glow');
    }
    render();
  };
  // No click interception or navigation timer: links retain all native behavior.
  for (const entry of entries) {
    const element: HTMLElement = entry.element;
    const on = <K extends keyof HTMLElementEventMap>(name: K, callback: (event: HTMLElementEventMap[K]) => void) => element.addEventListener(name, callback, { signal: listeners.signal });
    on('pointerenter', event => { if (event.pointerType !== 'touch') { entry.hovered = true; update(entry); } });
    on('pointerleave', () => { entry.hovered = false; entry.touched = false; update(entry); });
    on('focus', () => { entry.focused = entry.element.matches(':focus-visible'); update(entry); });
    on('blur', () => { entry.focused = false; update(entry); });
    on('pointerdown', event => { if (event.pointerType === 'touch') { entry.touched = true; update(entry); } });
    on('pointerup', () => { entry.touched = false; update(entry); });
    on('pointercancel', () => { entry.touched = false; update(entry); });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal: listeners.signal });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') reset();
  }, { signal: listeners.signal });
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    entries.forEach(entry => { entry.value = entry.target; entry.moving = false; drawEntry(entry); });
    render();
  }, { signal: listeners.signal });

  return {
    reset,
    resize() {
      const bounds = entries.map(entry => entry.motion.bounds);
      const rects = projectNavigationTargets(bounds, camera, host.clientWidth, host.clientHeight, entries.map(entry => entry.lane), entries.map((entry, index) => entry.hitArea ?? bounds[index]));
      entries.forEach((entry, index) => {
        const rect = rects[index];
        entry.element.hidden = !rect;
        if (rect) Object.assign(entry.element.style, {
          left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
        });
      });
    },
    dispose() {
      listeners.abort();
      reset();
      entries.forEach(entry => entry.element.remove());
    },
  };
}
