import * as THREE from 'three';
import { projectLogoBounds } from './channelLinks.ts';
import type { DojoRuntime, DoorHandleTarget } from './createDojoModel.ts';
import { ABOUT_DESTINATION } from './signage.ts';

export interface DoorInteractions { resize: () => void; reset: () => void; dispose: () => void }

export function doorEase(progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function setDoorProgress(target: DoorHandleTarget, progress: number) {
  const angle = target.openAngle * THREE.MathUtils.clamp(progress, 0, 1);
  const rest = target.leaf.userData.originalPosition as THREE.Vector3;
  target.leaf.rotation.y = angle;
  // The group origin is the physical outer hinge-barrel axis. Never translate
  // it during a swing: the center edge must travel while the hinged edge stays.
  target.leaf.position.copy(rest);
  target.leaf.updateWorldMatrix(true, true);
}

export type EntranceZone = 'closed' | 'west' | 'both' | 'east';

export function entranceZone(normalizedX: number): Exclude<EntranceZone, 'closed'> {
  const x = THREE.MathUtils.clamp(normalizedX, 0, 1);
  return x < 1 / 3 ? 'west' : x > 2 / 3 ? 'east' : 'both';
}

/** Native, accessible handle targets drive restrained outward door previews. */
export function createDoorInteractions(
  host: HTMLElement,
  camera: THREE.Camera,
  runtime: DojoRuntime,
  render: () => void,
  syncAttachedLinks: () => void,
): DoorInteractions {
  const listeners = new AbortController();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'door-handle-target';
  element.dataset.zone = 'closed';
  element.setAttribute('aria-label', 'Open About; hover left to preview the left door, center for both, or right for the right door');
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-controls', 'dojo-board');
  element.hidden = true;
  host.append(element);
  const motions = runtime.doorHandles.map(target => ({ target, value: 0, from: 0, goal: 0 }));
  let frame = 0;
  let started = 0, moving = false, hovered = false, focused = false;
  let pointerFocusing = false;
  let pointerZone: Exclude<EntranceZone, 'closed'> = 'both';

  const place = (force = false) => {
    // Keep the hit region stationary during a swing so its moving handles do
    // not change the pointer zone or cause hover oscillation.
    if (!force && (hovered || focused)) return;
    const bounds = new THREE.Box3();
    runtime.doorHandles.forEach(target => {
      target.handle.updateWorldMatrix(true, true);
      bounds.union(new THREE.Box3().setFromObject(target.handle));
    });
    const rect = projectLogoBounds(bounds, camera, host.clientWidth, host.clientHeight, 18, 64);
    if (rect) {
      const center = rect.left + rect.width / 2;
      const responsiveWidth = Math.min(180, Math.max(120, host.clientWidth * .28));
      rect.width = Math.min(host.clientWidth, Math.max(responsiveWidth, rect.width));
      rect.left = THREE.MathUtils.clamp(center - rect.width / 2, 0, host.clientWidth - rect.width);
    }
    element.hidden = !rect;
    if (rect) Object.assign(element.style, {
        left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    });
  };
  const draw = () => {
    motions.forEach(motion => setDoorProgress(motion.target, reducedMotion.matches ? 0 : motion.value));
    element.style.setProperty('--door-open', String(Math.max(...motions.map(motion => motion.value))));
  };
  const tick = (now: number) => {
    frame = 0;
    const opening = motions.some(motion => motion.goal > motion.from);
    const progress = Math.min(1, (now - started) / (opening ? 420 : 330));
    motions.forEach(motion => { motion.value = THREE.MathUtils.lerp(motion.from, motion.goal, doorEase(progress)); });
    moving = progress < 1;
    draw();
    place();
    syncAttachedLinks();
    render();
    if (moving) frame = requestAnimationFrame(tick);
  };
  const update = () => {
    const zone: EntranceZone = focused ? 'both' : hovered ? pointerZone : 'closed';
    const goals = motions.map(motion => Number(zone === 'both' || zone === motion.target.id));
    if (motions.every((motion, index) => motion.goal === goals[index])) return;
    motions.forEach((motion, index) => { motion.from = motion.value; motion.goal = goals[index]; });
    element.dataset.zone = zone;
    element.style.setProperty('--zone-x', zone === 'west' ? '17%' : zone === 'east' ? '83%' : '50%');
    started = performance.now();
    if (reducedMotion.matches) {
      motions.forEach(motion => { motion.value = 0; });
      moving = false;
      draw(); place(); syncAttachedLinks(); render();
    } else {
      moving = true;
      if (!frame) frame = requestAnimationFrame(tick);
    }
  };
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0;
    started = 0; moving = hovered = focused = pointerFocusing = false; pointerZone = 'both';
    motions.forEach(motion => { motion.value = motion.from = motion.goal = 0; });
    element.dataset.zone = 'closed';
    element.style.setProperty('--zone-x', '50%');
    draw();
    place(); syncAttachedLinks(); render();
  };

  const on = <K extends keyof HTMLElementEventMap>(name: K, callback: (event: HTMLElementEventMap[K]) => void) =>
    element.addEventListener(name, callback, { signal: listeners.signal });
  const updatePointerZone = (event: PointerEvent) => {
    const bounds = element.getBoundingClientRect();
    pointerZone = entranceZone((event.clientX - bounds.left) / Math.max(1, bounds.width));
    update();
  };
  on('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; updatePointerZone(event); } });
  on('pointermove', event => { if (event.pointerType !== 'touch') updatePointerZone(event); });
  on('pointerleave', () => { hovered = false; update(); place(true); });
  on('pointerdown', event => { if (event.pointerType !== 'touch') { pointerFocusing = true; focused = false; update(); } });
  on('pointerup', () => { pointerFocusing = false; });
  on('pointercancel', () => { pointerFocusing = false; });
  on('focus', () => { focused = !pointerFocusing && element.matches(':focus-visible'); update(); });
  on('blur', () => { focused = false; update(); place(true); });
  on('click', () => {
    // A pointer click gives a button ordinary focus in some browsers. It must
    // not become a persistent door-open state; keyboard focus-visible remains.
    if (!element.matches(':focus-visible')) { focused = false; element.blur(); update(); }
    location.hash = ABOUT_DESTINATION;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal: listeners.signal });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') reset(); }, { signal: listeners.signal });
  reducedMotion.addEventListener('change', reset, { signal: listeners.signal });

  return {
    resize() { place(true); },
    reset,
    dispose() {
      listeners.abort();
      reset();
      element.remove();
    },
  };
}
