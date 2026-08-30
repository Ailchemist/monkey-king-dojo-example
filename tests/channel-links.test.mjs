import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLogoMotion, projectNavigationTargets, hoverValue } from '../src/channelLinks.ts';
import { FRONT_FOV, MAX_SCENE_ASPECT, lockedFrame } from '../src/framing.ts';
import { FACADE_NAVIGATION, LOGO_LAYER_GAP, LOGO_PLACEMENTS } from '../src/signage.ts';

test('hover stays centered on the glass plane, holds its highlight, and restores ink exactly on leave', () => {
  const part = new THREE.Group();
  const doorLeaf = new THREE.Group();
  doorLeaf.position.set(-1.28, .05, -.14);
  doorLeaf.add(part);
  part.position.set(.3, -.2, .1);
  part.scale.set(1.2, .8, 1);
  const material = new THREE.MeshBasicMaterial({ color: '#9146ff' });
  const geometry = new THREE.BoxGeometry(1.6, .8, .001).translate(-3.5, 2.25, -.18);
  const mesh = new THREE.Mesh(geometry, material);
  part.add(mesh);
  const position = part.position.clone(), rotation = part.quaternion.clone(), scale = part.scale.clone(), color = material.color.clone();
  const motion = createLogoMotion(part);
  const center = motion.bounds.getCenter(new THREE.Vector3());
  for (const level of [.1, .25, .5, .75, 1, 1.04]) {
    motion.apply(level);
    const animatedCenter = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    assert.ok(Math.abs(animatedCenter.x - center.x) < 1e-9);
    assert.ok(Math.abs(animatedCenter.y - center.y) < 1e-9);
    assert.ok(Math.abs(animatedCenter.z - center.z) < 1e-9, 'glass-mounted ink never crosses its reflection coat');
    assert.ok(part.scale.x > scale.x);
    assert.ok(material.color.r > color.r);
  }
  motion.apply(0);
  assert.deepEqual(material.color, color);
  for (const reducedMotion of [false, true]) {
    motion.apply(reducedMotion ? 1 : 0, reducedMotion);
    assert.deepEqual(part.position, position);
    assert.deepEqual(part.quaternion.toArray(), rotation.toArray());
    assert.deepEqual(part.scale, scale);
  }
  assert.ok(material.color.r > color.r, 'reduced motion retains color feedback without a transform');
  motion.reset();
  assert.deepEqual(material.color, color);
  geometry.dispose();
  material.dispose();
});

test('multi-layer social logos stay behind the glass and span several depth-buffer steps', () => {
  const camera = new THREE.PerspectiveCamera(FRONT_FOV, 1, .08, 400);
  camera.position.set(0, 0, 16.8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const back = new THREE.Vector3(0, 0, -.157).project(camera).z;
  const front = new THREE.Vector3(0, 0, -.157 + LOGO_LAYER_GAP).project(camera).z;
  const depthSteps = Math.abs(front - back) * .5 * 2 ** 24;
  assert.ok(depthSteps >= 6, `logo layers have only ${depthSteps.toFixed(2)} 24-bit depth steps`);

  for (const sign of LOGO_PLACEMENTS) {
    const source = readFileSync(`public/brands/${sign.id}.svg`, 'utf8');
    const drawableLayers = [...source.matchAll(/<(?:path|polygon|rect|circle)\b/g)].length;
    const renderedLayers = sign.id === 'kick' ? 1 : drawableLayers;
    const coatZ = sign.parent === 'transom' ? -.153 : -.151;
    const frontLayerZ = sign.z + (renderedLayers - 1) * LOGO_LAYER_GAP;
    assert.ok(frontLayerZ < coatZ, `${sign.id} remains behind its glass reflection coat`);
  }
});

test('ten targets, including stacked door signs and full display windows, do not overlap on phones or ultrawide', () => {
  const camera = new THREE.PerspectiveCamera(FRONT_FOV, 1, .08, 400);
  const photoBox = (x, y, width, height, z) => {
    const scale = (16.8 - z) / 16.8;
    return new THREE.Box3().setFromPoints([-1, 1].flatMap(dx => [-1, 1].map(dy => new THREE.Vector3(
      (x + dx * width / 2 - 674.5) * .01 * scale,
      3.055 + ((724 - y - dy * height / 2) * .01 - 3.055) * scale, z,
    ))));
  };
  const geometry = new Map(LOGO_PLACEMENTS.map(s => [s.id, photoBox(s.x, s.y, s.width, s.width * s.svgHeight / s.svgWidth, s.z)]));
  geometry.set('merch', photoBox(320, 507, 190, 160, -.183));
  geometry.set('donate', photoBox(996, 507, 220, 160, -.183));
  geometry.set('portfolio', new THREE.Box3(new THREE.Vector3(-1.83, .33, .13), new THREE.Vector3(-1.62, 3.17, .142)));
  geometry.set('contact', new THREE.Box3(new THREE.Vector3(1.33, .33, .13), new THREE.Vector3(1.54, 3.17, .142)));
  const logos = FACADE_NAVIGATION.map(item => geometry.get(item.id));
  const hitAreas = FACADE_NAVIGATION.map(item => item.id === 'merch' ? photoBox(319.5, 507.5, 263, 237, -.183)
    : item.id === 'donate' ? photoBox(996, 510, 260, 238, -.183) : geometry.get(item.id));
  for (const [viewportWidth, height] of [[3440, 1440], [2724, 1250], [1350, 838], [544, 614], [390, 844], [320, 640]]) {
    const width = Math.min(viewportWidth, height * MAX_SCENE_ASPECT);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const frame = lockedFrame(camera.aspect);
    camera.position.set(0, frame.height, frame.distance);
    camera.lookAt(0, frame.height, 0);
    camera.updateMatrixWorld();
    const targets = projectNavigationTargets(logos, camera, width, height, FACADE_NAVIGATION.map(item => item.lane), hitAreas);
    for (const [index, box] of logos.entries()) {
      const rect = targets[index];
      assert.ok(rect);
      assert.ok(rect.width >= 24 && rect.height >= 24, `${FACADE_NAVIGATION[index].id} is usable at ${viewportWidth}px: ${rect.width} x ${rect.height}`);
      assert.ok(rect.left >= 0 && rect.top >= 0);
      assert.ok(rect.left + rect.width <= width && rect.top + rect.height <= height);
      for (const other of targets.slice(0, index)) {
        const overlapX = Math.min(rect.left + rect.width, other.left + other.width) - Math.max(rect.left, other.left);
        const overlapY = Math.min(rect.top + rect.height, other.top + other.height) - Math.max(rect.top, other.top);
        assert.ok(overlapX < 1e-6 || overlapY < 1e-6, 'adjacent columns and stacked rows do not overlap');
      }
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
        assert.ok(px >= rect.left && px <= rect.left + rect.width, 'ink is inside the horizontal hit area');
        assert.ok(py >= rect.top && py <= rect.top + rect.height, 'ink is inside the vertical hit area');
      }
    }
  }
});

test('hover transitions settle and reverse without a position jump', () => {
  assert.equal(hoverValue(0, 1, 0), 0);
  assert.equal(hoverValue(0, 1, 1), 1);
  assert.equal(hoverValue(0, 1, 20), 1);
  const interrupted = hoverValue(0, 1, .4);
  assert.equal(hoverValue(interrupted, 0, 0), interrupted);
  let previous = interrupted;
  for (let step = 0; step <= 20; step++) {
    const enter = hoverValue(0, 1, step / 20);
    assert.ok(enter >= 0 && enter <= 1.1);
    const leave = hoverValue(interrupted, 0, step / 20);
    assert.ok(leave >= 0 && leave <= previous);
    previous = leave;
  }
  assert.equal(previous, 0);
});

test('door-mounted logo bounds follow the leaf instead of staying cached at the facade', () => {
  const leaf = new THREE.Group();
  leaf.position.set(-1.3, 0, -.14);
  const logo = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.7, .35), new THREE.MeshBasicMaterial());
  mesh.position.set(.8, 1.6, 0);
  logo.add(mesh); leaf.add(logo);
  const motion = createLogoMotion(logo);
  const before = motion.bounds.getCenter(new THREE.Vector3());
  leaf.rotation.y = -.2;
  leaf.updateWorldMatrix(true, true);
  const after = motion.bounds.getCenter(new THREE.Vector3());
  assert.ok(after.distanceTo(before) > .1, 'native link bounds move with the door leaf');
  assert.equal(logo.parent, leaf, 'logo ink remains physically parented to the door');
  mesh.geometry.dispose(); mesh.material.dispose();
});
