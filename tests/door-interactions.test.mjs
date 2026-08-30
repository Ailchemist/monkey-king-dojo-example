import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { doorEase, entranceZone, setDoorProgress } from '../src/doorInteractions.ts';
import { FACADE_NAVIGATION, LOGO_PLACEMENTS } from '../src/signage.ts';

test('door easing is smooth, bounded and monotonic', () => {
  assert.equal(doorEase(-1), 0);
  assert.equal(doorEase(0), 0);
  assert.equal(doorEase(1), 1);
  assert.equal(doorEase(2), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const value = doorEase(i / 100);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.ok(doorEase(.01) < .001, 'opening begins without a sharp velocity jump');
  assert.ok(doorEase(.99) > .999, 'opening settles without a sharp stop');
});

test('door leaves retain their restrained mirrored outward angles', () => {
  const west = { id: 'west', leaf: new THREE.Group(), handle: new THREE.Group(), openAngle: THREE.MathUtils.degToRad(-14) };
  const east = { id: 'east', leaf: new THREE.Group(), handle: new THREE.Group(), openAngle: THREE.MathUtils.degToRad(14) };
  west.leaf.position.set(-1.2, .3, -.092);
  east.leaf.position.set(1.2, .3, -.092);
  west.leaf.userData.originalPosition = west.leaf.position.clone();
  east.leaf.userData.originalPosition = east.leaf.position.clone();
  const westPivot = west.leaf.position.clone();
  const eastPivot = east.leaf.position.clone();
  setDoorProgress(west, .5);
  setDoorProgress(east, .5);
  assert.equal(west.leaf.rotation.y, west.openAngle * .5);
  assert.equal(east.leaf.rotation.y, east.openAngle * .5, 'the opposite leaf opens at the same progress');
  setDoorProgress(west, 9);
  setDoorProgress(east, 9);
  assert.equal(west.leaf.rotation.y, west.openAngle);
  assert.equal(east.leaf.rotation.y, east.openAngle);
  assert.ok(Math.abs(west.openAngle) >= THREE.MathUtils.degToRad(12), 'west preview is visibly readable');
  assert.ok(Math.abs(east.openAngle) >= THREE.MathUtils.degToRad(12), 'east preview is visibly readable');
  assert.ok(Math.abs(west.openAngle) <= THREE.MathUtils.degToRad(14));
  assert.ok(Math.abs(east.openAngle) <= THREE.MathUtils.degToRad(14));
  assert.ok(west.openAngle < 0 && east.openAngle > 0, 'leaves swing outward in opposite directions');
  assert.deepEqual(west.leaf.position.toArray(), westPivot.toArray(), 'west hinge axis stays fixed');
  assert.deepEqual(east.leaf.position.toArray(), eastPivot.toArray(), 'east hinge axis stays fixed');
  setDoorProgress(west, 0); setDoorProgress(east, 0);
  assert.deepEqual(west.leaf.position.toArray(), westPivot.toArray());
  assert.deepEqual(east.leaf.position.toArray(), eastPivot.toArray());
});

test('pointer position selects left, paired, and right entrance motion', () => {
  assert.equal(entranceZone(-1), 'west');
  assert.equal(entranceZone(0), 'west');
  assert.equal(entranceZone(.32), 'west');
  assert.equal(entranceZone(.34), 'both');
  assert.equal(entranceZone(.5), 'both');
  assert.equal(entranceZone(.66), 'both');
  assert.equal(entranceZone(.68), 'east');
  assert.equal(entranceZone(1), 'east');
  assert.equal(entranceZone(2), 'east');
});

test('the scene exposes handle-only targets and door-local social signage', () => {
  const model = readFileSync('src/createDojoModel.ts', 'utf8');
  const interaction = readFileSync('src/doorInteractions.ts', 'utf8');
  for (const id of ['door-handle-west', 'door-handle-east']) assert.match(model, new RegExp(`'${id}'`));
  assert.match(interaction, /setFromObject\(target\.handle\)/, 'hit region derives from the two handle geometries');
  assert.doesNotMatch(interaction, /setFromObject\(target\.leaf\)/, 'the full leaves are not used as the hover target');
  assert.match(interaction, /syncAttachedLinks\(\)/, 'moving doors resynchronize attached native links');
  assert.match(interaction, /zone === 'both' \|\| zone === motion\.target\.id/, 'the center drives both leaves and the outside zones drive one');
  assert.match(interaction, /if \(!force && \(hovered \|\| focused\)\) return/, 'the hit region stays stable while doors move');
  assert.match(interaction, /Math\.min\(180, Math\.max\(120, host\.clientWidth \* \.28\)\)/, 'the three positional zones use a bounded responsive width');
  assert.match(interaction, /focused = !pointerFocusing && element\.matches\(':focus-visible'\)/, 'persistent animation is limited to keyboard-visible focus');
  assert.match(interaction, /if \(!element\.matches\(':focus-visible'\)\) \{ focused = false; element\.blur\(\); update\(\); \}/, 'mouse clicks cannot latch the door state');
  assert.match(interaction, /location\.hash = ABOUT_DESTINATION/, 'activating the handle region opens the About route');
  assert.match(interaction, /aria-haspopup', 'dialog'/, 'the handle exposes its dialog behavior');
  assert.match(interaction, /prefers-reduced-motion: reduce/);
  assert.match(interaction, /visibilitychange/);
  assert.match(interaction, /Escape/);
  assert.deepEqual(LOGO_PLACEMENTS.filter(sign => ['youtube', 'kick'].includes(sign.id)).map(sign => sign.parent), ['door-west', 'door-west']);
  assert.deepEqual(LOGO_PLACEMENTS.filter(sign => ['instagram', 'twitch'].includes(sign.id)).map(sign => sign.parent), ['door-east', 'door-east']);
});

test('real facade navigation has pointer priority over the decorative door preview', () => {
  const css = readFileSync('src/desktopScene.css', 'utf8');
  const links = readFileSync('src/channelLinks.ts', 'utf8');
  assert.match(css, /\.channel-link\{[^}]*z-index:2/);
  assert.match(css, /\.door-handle-target\{[^}]*z-index:1/);
  assert.match(css, /#scene\{[^}]*isolation:isolate/);
  assert.match(links, /element\.href = item\.href/);
  assert.doesNotMatch(links, /preventDefault\(/, 'native anchor navigation is never intercepted');
  assert.deepEqual(FACADE_NAVIGATION.filter(item => ['portfolio', 'contact'].includes(item.id)).map(item => [item.id, item.href]), [
    ['portfolio', '#portfolio'], ['contact', '#contact'],
  ]);
  assert.match(readFileSync('src/desktopScene.ts', 'utf8'), /\^#\(about\|portfolio\|contact\)/, 'desktop route loader recognizes About');
});

test('inferred shell has useful depth and inspection-ready elevations', () => {
  const model = readFileSync('src/createDojoModel.ts', 'utf8');
  assert.match(model, /buildingDepth = 11\.1/);
  for (const part of ['perimeter-parapet', 'rear-service-door', 'rear-louver-', 'roof-equipment', 'entrance-vestibule']) assert.ok(model.includes(part), `${part} is represented`);
  assert.match(model, /Full-depth side walls · inferred/);
  assert.match(model, /Rear service elevation · inferred/);
  assert.match(model, /const interiorFrontZ = -\.32/);
  assert.match(model, /interiorFloor\.castShadow = false/);
  assert.doesNotMatch(model, /'interior-floor', \[13, \.12, buildingDepth\]/, 'the dark slab must not reach the photographed frontage');
});

test('animated leaves use fitted crops of the high-quality facade texture', () => {
  const model = readFileSync('src/createDojoModel.ts', 'utf8');
  const materials = readFileSync('src/materials.ts', 'utf8');
  assert.match(model, /textureCrop:\[548,440,661,719\]/, 'west crop reaches the shared photographed meeting line');
  assert.match(model, /textureCrop:\[661,440,775,719\]/, 'east crop begins at the same shared meeting line');
  assert.doesNotMatch(model, /door-meeting-reveal-black|sourceInterval/, 'the photographed line is texture, never separate gap geometry');
  assert.match(model, /leaf\.userData\.textureCrop = d\.textureCrop/);
  assert.match(materials, /textures\/facade-albedo-bb8813aca50c\.webp/, 'door UV crops retain the optimized high-quality Reference2 atlas');
  assert.doesNotMatch(model, /door-east-center-astragal|bottom-sweep|solidProfile/, 'no generic band replaces observed door detail');
  assert.match(model, /const doorBack = material\('#070908', \.94\)/);
  assert.match(model, /aluminum, doorBack\)/, 'door rail fronts keep the atlas while every return uses near-black');
  assert.match(model, /glass, doorBack\)/, 'glass front keeps its crop while its interior cap is near-black');
  assert.match(model, /nonFrontMaterial = 'near-black-untextured'/);
  assert.match(model, /referencePoint\(d\.hinge\[0\], d\.hinge\[1\], -\.092\)/, 'leaf group origin uses the actual outer hinge-barrel depth');
  assert.doesNotMatch(model, /meetingLocalX/, 'door runtime contains no translation compensation');
  assert.match(model, /degToRad\(index \? 14 : -14\)/, 'preview has a clearly readable fourteen-degree swing');
});

test('closed door front reconstructs the source continuously across its meeting stiles', () => {
  const layout = JSON.parse(readFileSync('src/facade-data.json', 'utf8'));
  assert.equal(layout.doorWest[1][0], 661);
  assert.equal(layout.doorWest[2][0], 661);
  assert.equal(layout.doorEast[0][0], 661);
  assert.equal(layout.doorEast[3][0], 661);
  assert.equal(layout.doorEast[0][0] - layout.doorWest[1][0], 0, 'closed front caps meet with zero modeled space');
});
