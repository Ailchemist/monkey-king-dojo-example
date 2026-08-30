import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONT_FOV, SAFE_FACADE_WIDTH, MAX_SCENE_ASPECT, lockedFrame } from '../src/framing.ts';
import { chooseLayout } from '../src/presentation.ts';

test('presentation follows available width, including phone rotation and live resize', () => {
  const viewports = [[320, 640], [390, 844], [639, 900], [640, 900], [844, 390], [667, 375], [390, 844], [3440, 1440]];
  assert.deepEqual(viewports.map(([width]) => chooseLayout(width)), ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'desktop', 'mobile', 'desktop']);
  for (const width of [0, -1, Infinity, NaN]) assert.equal(chooseLayout(width), 'desktop');
});

test('resize keeps both display bays visible while cropping the outer ends', () => {
  for (const aspect of [.25, .46, .75, .886, 1, 1.31, 1.61, 2, 2.4, 3.56, 5]) {
    const frame = lockedFrame(aspect);
    const width = 2 * frame.distance * Math.tan(FRONT_FOV * Math.PI / 360) * frame.aspect;
    assert.ok(Math.abs(width - SAFE_FACADE_WIDTH) < 1e-10, `wrong crop at aspect ${aspect}`);
    assert.ok(width > 9.6 && width < 12.6, 'both main windows visible, original outer ends cropped');
    assert.ok(frame.distance > 0);
    assert.equal(frame.aspect, Math.min(aspect, MAX_SCENE_ASPECT));
    assert.ok(frame.height + frame.frameHeight / 2 >= 7.35, 'roof fits even on ultrawide screens');
    assert.ok(frame.height - frame.frameHeight / 2 < -.9, 'doors and pavement fit');
  }
});

test('invalid dimensions remain finite', () => {
  for (const aspect of [0, -1, Infinity, NaN]) assert.ok(Number.isFinite(lockedFrame(aspect).distance));
});
