/** Keep both display bays in view, cropping only the unfinished outer ends. */
export const FRONT_FOV = 28;
export const SAFE_FACADE_WIDTH = 12.2;
// A taller stage preserves the roof and pavement without revealing side ends.
export const MAX_SCENE_ASPECT = 1.45;

export function lockedFrame(aspect: number) {
  const safeAspect = Math.min(MAX_SCENE_ASPECT, Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
  const frameHeight = SAFE_FACADE_WIDTH / safeAspect;
  const distance = frameHeight / (2 * Math.tan(FRONT_FOV * Math.PI / 360));
  return {
    distance,
    // On tall screens use the extra sky/ground instead of cutting off the windows.
    height: Math.max(3.18, Math.min(3.65, 7.35 - frameHeight / 2)),
    frameHeight,
    visibleWidth: SAFE_FACADE_WIDTH,
    aspect: safeAspect,
  };
}
