import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { createSurfaceLibrary } from './materials';
import layout from './facade-data.json';
import { createPillarLetter, createSignLetter } from './pillarLettering';
import { EXTERNAL_LINKS, LOGO_LAYER_GAP, LOGO_PLACEMENTS } from './signage';

export const BUILD_STAGES = ['blockout', 'structural-pass', 'form-refinement', 'material-pass', 'surface-pass', 'lighting-pass', 'interaction-pass', 'optimization-pass'] as const;
export type BuildStage = typeof BUILD_STAGES[number];
export const CURRENT_STAGE: BuildStage = 'surface-pass';
export type Point2 = readonly number[];

export interface DojoOptions { stage?: BuildStage; anisotropy?: number; assetBase?: string }
export interface DojoRuntime {
  parts: Map<string, THREE.Group>;
  meshes: THREE.Mesh[];
  doors: THREE.Group[];
  doorHandles: DoorHandleTarget[];
  stage: BuildStage;
  environment?: THREE.Texture;
  dispose: () => void;
}
export interface DoorHandleTarget {
  id: 'west' | 'east';
  leaf: THREE.Group;
  handle: THREE.Group;
  openAngle: number;
}

/** Reference coordinates are baked into geometry, never tied to the viewing camera. */
export function referencePoint(px: number, py: number, z = 0): THREE.Vector3 {
  const perspectiveScale = (layout.projectorZ - z) / layout.projectorZ;
  return new THREE.Vector3(
    (px - layout.width / 2) * layout.metresPerPixel * perspectiveScale,
    layout.projectorY + ((layout.groundY - py) * layout.metresPerPixel - layout.projectorY) * perspectiveScale,
    z,
  );
}

/** A complete architectural group, suitable for mounting into any Three.js scene. */
export async function createDojoModel(options: DojoOptions = {}): Promise<THREE.Group> {
  const stage = options.stage ?? CURRENT_STAGE;
  const stageIndex = BUILD_STAGES.indexOf(stage);
  const root = new THREE.Group();
  root.name = 'Monkey King Dojo';
  const parts = new Map<string, THREE.Group>();
  root.userData = { partId: 'root', label: 'Dojo frontage', originalPosition: root.position.clone() };
  parts.set('root', root);
  const meshes: THREE.Mesh[] = [];
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const doors: THREE.Group[] = [];
  const doorHandles: DoorHandleTarget[] = [];
  const part = (id: string, label: string, parent: THREE.Group = root) => {
    const group = new THREE.Group();
    group.name = id;
    group.userData = { partId: id, label, originalPosition: group.position.clone(), collider: 'box', destructionGroup: id };
    parent.add(group);
    parts.set(id, group);
    return group;
  };
  const material = (color: THREE.ColorRepresentation, roughness = 0.9, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  };
  const library = stageIndex >= 3 ? await createSurfaceLibrary(options.assetBase ?? '/',options.anisotropy ?? 8) : null;
  library?.materials.forEach(m=>materials.add(m));
  const stucco = library?.stucco ?? material('#cbbda7');
  const paint = library?.paint ?? material('#393934');
  const glass = library?.glass ?? material('#17201e', .5);
  const aluminum = library?.aluminum ?? material('#9a968b', .43, .65);
  const concrete = library?.concrete ?? material('#baaa94');
  const asphalt = library?.asphalt ?? material('#6c685f');
  const inside = library?.inside ?? material('#25251e');
  const rubber = library?.rubber ?? material('#161a15', .95);
  const doorBack = material('#070908', .94);

  const addMesh = (group: THREE.Group, id: string, geometry: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { partId: group.userData.partId, explodeWithParent: true };
    group.add(mesh);
    meshes.push(mesh);
    geometries.add(geometry);
    return mesh;
  };

  // Each profile is a closed, thick architectural solid. Only its observed front
  // cap receives source-image UVs; returns have their own world-scale mapping.
  const profile = (group: THREE.Group, id: string, points: Point2[], z: number, depth: number, mat: THREE.Material, returnMat: THREE.Material = stucco) => {
    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      const v = referencePoint(p[0], p[1], z);
      if (i === 0) shape.moveTo(v.x, v.y); else shape.lineTo(v.x, v.y);
    });
    shape.closePath();
    const bevel = stageIndex >= 2 && depth > .03;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel, bevelSize: .0025, bevelThickness: .002, bevelSegments: 1, curveSegments: 1, steps: 1 });
    geometry.translate(0, 0, z - depth);
    const p = geometry.getAttribute('position');
    const n = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const k = (layout.projectorZ - p.getZ(i)) / layout.projectorZ;
      if (n.getZ(i) > .9) {
        const px = p.getX(i) / k / layout.metresPerPixel + layout.width / 2;
        const py = layout.groundY - ((p.getY(i) - layout.projectorY) / k + layout.projectorY) / layout.metresPerPixel;
        uv.setXY(i, px / layout.width, 1 - py / layout.height);
      } else {
        uv.setXY(i, Math.abs(n.getX(i)) > .5 ? p.getZ(i) : p.getX(i), p.getY(i));
      }
    }
    geometry.clearGroups();
    let start = 0;
    let current = n.getZ(0) > .9 ? 0 : 1;
    for (let i = 3; i <= p.count; i += 3) {
      const next = i < p.count ? (n.getZ(i) > .9 ? 0 : 1) : -1;
      if (next !== current) { geometry.addGroup(start, i - start, current); start = i; current = next; }
    }
    return addMesh(group, id, geometry, [library?.projected.get(mat) ?? mat, returnMat]);
  };
  const box = (group: THREE.Group, id: string, size: [number, number, number], position: [number, number, number], mat: THREE.Material) => {
    const mesh = addMesh(group, id, new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...position);
    return mesh;
  };
  const ring = (group: THREE.Group, id: string, outer: Point2[], inner: Point2[], z: number, depth: number, mat: THREE.Material) => {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      profile(group, `${id}-${i}`, [outer[i], outer[j], inner[j], inner[i]], z, depth, mat, mat);
    }
  };
  const inset = (points: Point2[], amount: number) => points.map((p, i) => [p[0] + ([0, 3].includes(i) ? amount : -amount), p[1] + (i < 2 ? amount : -amount)]);
  const roundedBox = (group: THREE.Group, id: string, size: [number, number, number], position: THREE.Vector3, mat: THREE.Material, radius = .003) => {
    const mesh = addMesh(group,id,new RoundedBoxGeometry(...size,2,radius),mat);
    mesh.position.copy(position);
    return mesh;
  };

  const shell = part('shell', 'Lime stucco · building envelope');
  const piers = part('pilasters', 'Raised stucco pilasters', shell);
  layout.walls.forEach(w => profile(piers, w.id, w.points, w.z, .43, stucco));
  if (stageIndex >= 4) {
    for (const sign of [
      { id: 'portfolio', text: 'PORTFOLIO', x: 500.5 },
      { id: 'contact', text: 'CONTACT', x: 819 },
    ]) {
      const lettering = part(`pillar-${sign.id}`, `${sign.text} · inner door pillar`, piers);
      lettering.userData.navType = 'pillar';
      const bronze = material('#45271e', .48, .30);
      for (let i = 0; i < sign.text.length; i++) {
        const letter = addMesh(lettering, `${sign.id}-letter-${i}-${sign.text[i]}`, createPillarLetter(sign.text[i]), bronze);
        letter.position.copy(referencePoint(sign.x, 421 + i * 258 / (sign.text.length - 1), .132));
      }
    }
  }
  const spandrels = part('spandrels', 'Window spandrels', shell);
  layout.spandrels.forEach(w => profile(spandrels, w.id, w.points, w.z, .37, stucco));
  // Only the frontage is visible in the source photograph. The remaining
  // envelope is an explicitly inferred, restrained commercial shell.
  const buildingDepth = 11.1, rearZ = -10.95, shellCenterZ = (rearZ + .15) / 2;
  const sidewalls = part('sidewalls', 'Full-depth side walls · inferred', shell);
  box(sidewalls, 'sidewall-west', [.24, 6.85, buildingDepth], [-6.46, 3.38, shellCenterZ], stucco);
  box(sidewalls, 'sidewall-east', [.24, 6.73, buildingDepth], [6.45, 3.32, shellCenterZ], stucco);
  const back = part('back-wall', 'Rear service elevation · inferred', shell);
  box(back, 'rear-stucco', [13.12, 6.8, .24], [0, 3.35, rearZ], stucco);
  const roof = part('roof', 'Full flat roof assembly · inferred', shell);
  box(roof, 'roof-deck', [13.1, .13, buildingDepth], [0, 6.70, shellCenterZ], concrete);
  box(roof, 'roof-membrane', [12.72, .045, buildingDepth - .35], [0, 6.79, shellCenterZ - .03], rubber);
  const interior = part('interior', 'Interior slab and entrance vestibule · inferred', shell);
  // Keep the inferred slab behind the entrance assembly. Extending it to the
  // shell's front bound exposes its dark cut edge below the photographed sill.
  const interiorFrontZ = -.32;
  const interiorFloor = box(interior, 'interior-floor', [13, .12, interiorFrontZ - rearZ], [0, -.08, (rearZ + interiorFrontZ) / 2], inside);
  interiorFloor.castShadow = false;

  if (stageIndex >= 2) {
    const sideDetails = part('side-elevation-details', 'Side elevation bands and bays · inferred', shell);
    for (const side of [-1, 1]) {
      const sideName = side < 0 ? 'west' : 'east', x = side * 6.595;
      box(sideDetails, `side-${sideName}-base`, [.075, .56, buildingDepth - .2], [x, .30, shellCenterZ], concrete);
      box(sideDetails, `side-${sideName}-cornice`, [.10, .20, buildingDepth - .12], [x, 6.13, shellCenterZ], stucco);
      for (const [index, z] of [-2.55, -5.35, -8.15].entries()) box(sideDetails, `side-${sideName}-pier-${index}`, [.09, 5.45, .18], [x, 3.25, z], stucco);
    }
    const parapet = part('perimeter-parapet', 'Perimeter parapet and coping · inferred', roof);
    for (const side of [-1, 1]) {
      box(parapet, `side-parapet-${side}`, [.25, .52, buildingDepth], [side * 6.46, 6.96, shellCenterZ], stucco);
      box(parapet, `side-coping-${side}`, [.38, .075, buildingDepth + .12], [side * 6.46, 7.255, shellCenterZ], aluminum);
    }
    box(parapet, 'rear-parapet', [13.16, .52, .25], [0, 6.96, rearZ], stucco);
    box(parapet, 'rear-coping', [13.32, .075, .38], [0, 7.255, rearZ], aluminum);

    const rearService = part('rear-service', 'Rear service fixtures · inferred', back);
    box(rearService, 'rear-base-course', [12.85, .58, .075], [0, .31, rearZ - .15], concrete);
    const serviceDoor = part('rear-service-door', 'Steel service door · inferred', rearService);
    box(serviceDoor, 'service-door-leaf', [1.22, 2.45, .07], [3.95, 1.27, rearZ - .165], paint);
    box(serviceDoor, 'service-door-frame-top', [1.34, .075, .10], [3.95, 2.53, rearZ - .18], aluminum);
    for (const x of [3.31, 4.59]) box(serviceDoor, `service-door-frame-${x}`, [.075, 2.54, .10], [x, 1.27, rearZ - .18], aluminum);
    roundedBox(serviceDoor, 'service-door-handle', [.32, .045, .055], new THREE.Vector3(3.70, 1.30, rearZ - .23), aluminum, .008);
    for (const [index, y] of [3.70, 4.65].entries()) {
      const vent = part(`rear-louver-${index}`, 'Rear ventilation louver · inferred', rearService);
      box(vent, `rear-louver-frame-${index}`, [1.65, .66, .075], [-2.75, y, rearZ - .165], aluminum);
      box(vent, `rear-louver-dark-${index}`, [1.48, .50, .085], [-2.75, y, rearZ - .21], inside);
      for (let l = 0; l < 6; l++) box(vent, `rear-louver-${index}-blade-${l}`, [1.40, .025, .055], [-2.75, y - .20 + l * .08, rearZ - .27], aluminum);
    }
    const utilities = part('exterior-utilities', 'Downspouts and conduit · inferred', shell);
    for (const x of [-6.61, 6.61]) box(utilities, `downspout-${x}`, [.09, 5.95, .09], [x, 3.0, rearZ + .42], aluminum);

    const roofEquipment = part('roof-equipment', 'Low-profile rooftop equipment · inferred', roof);
    for (const [index, x, z] of [[0, -2.75, -5.3], [1, 2.45, -7.6]] as const) {
      box(roofEquipment, `hvac-curb-${index}`, [2.15, .19, 1.65], [x, 6.92, z], concrete);
      roundedBox(roofEquipment, `hvac-cabinet-${index}`, [1.88, .78, 1.38], new THREE.Vector3(x, 7.37, z), aluminum, .035);
      const fan = addMesh(roofEquipment, `hvac-fan-${index}`, new THREE.CylinderGeometry(.48, .48, .035, 40), rubber);
      fan.position.set(x, 7.78, z);
      for (let blade = 0; blade < 4; blade++) {
        const mesh = box(roofEquipment, `hvac-fan-${index}-blade-${blade}`, [.55, .018, .085], [x, 7.805, z], aluminum);
        mesh.rotation.y = blade * Math.PI / 2 + .35;
      }
    }
    const hatch = part('roof-hatch', 'Roof access hatch · inferred', roofEquipment);
    box(hatch, 'roof-hatch-curb', [1.15, .18, 1.15], [3.8, 6.91, -3.85], concrete);
    roundedBox(hatch, 'roof-hatch-lid', [1.08, .10, 1.08], new THREE.Vector3(3.8, 7.055, -3.85), aluminum, .025);

    const vestibule = part('entrance-vestibule', 'Finished entrance vestibule · inferred', interior);
    box(vestibule, 'vestibule-floor-mat', [2.20, .025, 2.15], [0, .015, -1.25], rubber);
    box(vestibule, 'vestibule-back-wall', [2.55, 3.25, .10], [0, 1.62, -2.42], inside);
    box(vestibule, 'vestibule-west-wall', [.10, 3.25, 2.25], [-1.27, 1.62, -1.30], inside);
    box(vestibule, 'vestibule-east-wall', [.10, 3.25, 2.25], [1.27, 1.62, -1.30], inside);
    box(vestibule, 'vestibule-ceiling', [2.55, .10, 2.25], [0, 3.25, -1.30], inside);
    const warmLight = material('#ffd39b', .42);
    if (warmLight instanceof THREE.MeshStandardMaterial) { warmLight.emissive.set('#efad64'); warmLight.emissiveIntensity = 1.35; }
    roundedBox(vestibule, 'vestibule-light', [.62, .045, .28], new THREE.Vector3(0, 3.18, -1.02), warmLight, .02);
  }

  const fascia = part('fascia', 'Original painted fascia');
  profile(fascia, 'fascia-substrate', layout.fasciaOutline, .17, .55, stucco);
  profile(fascia, 'mural-face', layout.muralOutline, .175, .008, paint, paint);

  const display = part('display-bays', 'Twin display windows');
  const glazing = part('window-glass', 'Display glazing · Merch and Donate', display);
  layout.windows.forEach(w => {
    const replacement = library && (w.id === 'west' || w.id === 'east');
    const pane = profile(glazing, `${w.id}-glass`, stageIndex ? w.glass : w.outer, w.glassZ, .015, replacement ? library.displayGlass : glass, glass);
    if (replacement) {
      pane.geometry.computeBoundingBox();
      const bounds = pane.geometry.boundingBox!;
      const position = pane.geometry.getAttribute('position'), uv = pane.geometry.getAttribute('uv');
      for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x), (position.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y));
    }
  });
  // Preserve the accepted historical material-pass render; the public surface
  // pass uses the user's revised storefront below.
  if (library && stageIndex === 3) {
    const decals = [
      { brand: 'kick', label: 'KICK · left window vinyl', x: 320, y: 497, width: 194, svgWidth: 77.8771, svgHeight: 26 },
      { brand: 'twitch', label: 'Twitch · right window vinyl', x: 996, y: 497, width: 116.57, svgWidth: 2400, svgHeight: 2800 },
    ];
    const assets = await Promise.all(decals.map(d => new SVGLoader().loadAsync(`${options.assetBase ?? '/'}brands/${d.brand}.svg`)));
    decals.forEach((d, index) => {
      const decal = part(`window-logo-${d.brand}`, d.label, display);
      decal.userData.brand = d.brand;
      const scale = d.width / d.svgWidth;
      assets[index].paths.forEach((path, layer) => {
        // KICK's source file also includes its old BETA annotation outside the wordmark.
        if (d.brand === 'kick' && layer > 0) return;
        const ink = new THREE.MeshBasicMaterial({ color: path.color, side: THREE.DoubleSide, toneMapped: false });
        materials.add(ink);
        path.toShapes().forEach((shape, shapeIndex) => {
          const geometry = new THREE.ShapeGeometry(shape);
          const position = geometry.getAttribute('position');
          for (let i = 0; i < position.count; i++) {
            const p = referencePoint(d.x + (position.getX(i) - d.svgWidth / 2) * scale, d.y + (position.getY(i) - d.svgHeight / 2) * scale, -.183 + layer * .0002);
            position.setXYZ(i, p.x, p.y, p.z);
          }
          geometry.computeVertexNormals();
          const mesh = addMesh(decal, `${d.brand}-ink-${layer}-${shapeIndex}`, geometry, ink);
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        });
      });
    });
  }
  if (library && stageIndex >= 4) {
    for (const sign of [{ id: 'merch', text: 'MERCH', x: 320, window: 'west' }, { id: 'donate', text: 'DONATE', x: 996, window: 'east' }] as const) {
      const metadata = EXTERNAL_LINKS[sign.id];
      const group = part(metadata.partId, `${sign.text} · display window sign`, display);
      const ink = new THREE.MeshBasicMaterial({ color: metadata.color, side: THREE.DoubleSide, toneMapped: false });
      materials.add(ink);
      const glassWindow = layout.windows.find(w => w.id === sign.window)!;
      group.userData.hitArea = new THREE.Box3().setFromPoints(glassWindow.glass.map(p => referencePoint(p[0], p[1], -.183)));
      const letters = [...sign.text].map(letter => createSignLetter(letter, .39));
      const widths = letters.map(geometry => { geometry.computeBoundingBox(); return geometry.boundingBox!.max.x - geometry.boundingBox!.min.x; });
      const spacing = .085;
      let cursor = -(widths.reduce((sum, width) => sum + width, 0) + spacing * (letters.length - 1)) / 2;
      letters.forEach((geometry, i) => {
        const mesh = addMesh(group, `${sign.id}-letter-${i}`, geometry, ink);
        mesh.position.copy(referencePoint(sign.x, 550, -.183));
        mesh.position.x += cursor + widths[i] / 2;
        mesh.castShadow = false; mesh.receiveShadow = false;
        cursor += widths[i] + spacing;
      });
      const symbol = new THREE.Shape();
      if (sign.id === 'merch') {
        symbol.moveTo(-.17, .43).bezierCurveTo(-.14, .23, .14, .23, .17, .43)
          .lineTo(.34, .38).lineTo(.57, .18).lineTo(.40, -.04).lineTo(.29, .04)
          .lineTo(.29, -.43).lineTo(-.29, -.43).lineTo(-.29, .04)
          .lineTo(-.40, -.04).lineTo(-.57, .18).lineTo(-.34, .38).closePath();
      } else {
        symbol.moveTo(0, -.31).bezierCurveTo(-.04, -.23, -.34, -.05, -.34, .14)
          .bezierCurveTo(-.34, .37, -.09, .42, 0, .21)
          .bezierCurveTo(.09, .42, .34, .37, .34, .14)
          .bezierCurveTo(.34, -.05, .04, -.23, 0, -.31).closePath();
        const rim = new THREE.Shape(); rim.absarc(0, 0, .49, 0, Math.PI * 2, false);
        const cutout = new THREE.Path(); cutout.absarc(0, 0, .46, 0, Math.PI * 2, true); rim.holes.push(cutout);
        const ringMesh = addMesh(group, 'donate-symbol-rim', new THREE.ShapeGeometry(rim, 32), ink);
        ringMesh.position.copy(referencePoint(sign.x, 474, -.183));
        ringMesh.castShadow = false; ringMesh.receiveShadow = false;
      }
      const symbolMesh = addMesh(group, `${sign.id}-symbol`, new THREE.ShapeGeometry(symbol, 24), ink);
      symbolMesh.position.copy(referencePoint(sign.x, 474, -.183));
      symbolMesh.castShadow = false; symbolMesh.receiveShadow = false;
      const underline = addMesh(group, `${sign.id}-underline`, new THREE.PlaneGeometry(1.14, .012), ink);
      underline.position.copy(referencePoint(sign.x, 583, -.183));
      underline.castShadow = false; underline.receiveShadow = false;
    }
  }
  if(library) layout.windows.forEach(w=>{
    const coat=profile(glazing,`${w.id}-glass-reflection`,w.glass,w.glassZ+.012,.001,library.glassCoat,library.glassCoat);
    coat.castShadow=false;
    coat.renderOrder=2;
  });
  const backing = part('window-backing', 'Dark display interiors', display);
  layout.windows.forEach(w => profile(backing, `${w.id}-backing`, w.outer, -.52, .03, inside, inside));
  const entrance = part('entrance', 'Central double-door entrance');
  if (stageIndex === 0) profile(entrance, 'entrance-blockout', layout.entrance, -.17, .05, glass, aluminum);
  if (stageIndex >= 1) {
    const coping = part('coping', 'Sheet-metal roof coping', fascia);
    const upper = part('upper-bands', 'Stepped upper cornice', fascia);
    const lower = part('lower-bands', 'Continuous lower fascia bands', fascia);
    layout.bands.forEach(b => {
      const points = [...b.upper, ...b.upper.map(p => [p[0], p[1] + b.thickness]).reverse()];
      profile(b.id.includes('coping') ? coping : b.id.startsWith('upper') ? upper : lower, b.id, points, b.z, .20, b.id.includes('coping') ? aluminum : stucco);
    });
    const frames = part('display-frames', 'Anodized aluminum display frames', display);
    const seals = part('seal-beads', 'Rubber glazing gaskets', frames);
    const sills = part('window-sills', 'Cast window sills with projecting lips', display);
    layout.windows.forEach(w => {
      ring(frames, `${w.id}-frame`, w.outer, w.glass, -.075, .14, aluminum);
      ring(seals, `${w.id}-gasket`, w.glass, inset(w.glass, 2), -.157, .028, rubber);
      if (w.id !== 'return-west') {
        const bl = w.outer[3], br = w.outer[2];
        profile(sills, `${w.id}-sill`, [[bl[0]-7,bl[1]-1],[br[0]+6,br[1]-1],[br[0]+6,br[1]+7],[bl[0]-7,bl[1]+7]], .058, .27, stucco);
      }
    });
    ring(entrance, 'outer-door-jamb', layout.entrance, [[549,387],[772,387],[774,718],[545,718]], -.055, .20, aluminum);
    const transom = part('transom', 'Two glazed transom panes', entrance);
    profile(transom, 'transom-west-glass', [[550,386],[656,386],[656,428],[549,428]], -.175, .009, glass, glass);
    profile(transom, 'transom-east-glass', [[665,386],[774,386],[774,428],[665,428]], -.175, .009, glass, glass);
    profile(transom, 'transom-vertical-mullion', [[657,384],[664,384],[664,430],[657,430]], -.057, .12, aluminum, aluminum);
    profile(transom, 'transom-cross-rail', [[546,429],[777,429],[777,440],[546,440]], -.05, .14, aluminum, aluminum);
    if (stageIndex >= 4 && library) {
      for (const [id, points] of [
        ['west', [[550,386],[656,386],[656,428],[549,428]]],
        ['east', [[665,386],[774,386],[774,428],[665,428]]],
      ] as const) {
        const coat = profile(transom, `transom-${id}-reflection`, points.map(point => [...point]), -.153, .001, library.glassCoat, library.glassCoat);
        coat.castShadow = false; coat.renderOrder = 2;
      }
    }
    // Both physical front caps meet at one shared source coordinate. The dark
    // line visible in the photograph is atlas ink around x=660..661, not an
    // empty architectural reveal, so no separate gap geometry belongs here.
    const doorData = [
      {id:'door-west',outer:[[548,440],[661,440],[661,719],[546,719]],inner:[[555,448],[648,448],[648,686],[553,686]],hinge:[547,719],textureCrop:[548,440,661,719]},
      {id:'door-east',outer:[[661,440],[773,440],[775,719],[661,719]],inner:[[671,448],[765,448],[767,686],[671,686]],hinge:[774,719],textureCrop:[661,440,775,719]},
    ];
    doorData.forEach(d => {
      const leaf = part(d.id, d.id === 'door-west' ? 'Left entrance door' : 'Right entrance door', entrance);
      leaf.userData.textureCrop = d.textureCrop;
      leaf.userData.textureSource = 'textures/facade-albedo-bb8813aca50c.webp';
      for (let side = 0; side < 4; side++) {
        const next = (side + 1) % 4;
        // Only front caps retain their atlas crop. All depth and interior caps
        // are intentionally near-black so no mapped detail travels inside.
        profile(leaf, `${d.id}-rail-${side}`, [d.outer[side], d.outer[next], d.inner[next], d.inner[side]], -.09, .075, aluminum, doorBack);
      }
      leaf.userData.nonFrontMaterial = 'near-black-untextured';
      profile(leaf, `${d.id}-glass`, d.inner, -.165, .009, glass, doorBack);
      if(library) {
        const coat=profile(leaf,`${d.id}-glass-reflection`,d.inner,-.151,.001,library.glassCoat,library.glassCoat);
        coat.castShadow=false; coat.renderOrder=2;
      }
      profile(leaf, `${d.id}-cross-rail`, [[d.inner[0][0],558],[d.inner[1][0],558],[d.inner[1][0],565],[d.inner[0][0],565]], -.086, .055, aluminum, doorBack);
      // Rebase the complete leaf on the actual outer hinge-barrel axis. The
      // group origin never moves; only its Y rotation changes when opening.
      const hinge = referencePoint(d.hinge[0], d.hinge[1], -.092);
      leaf.children.forEach(child => { if (child instanceof THREE.Mesh) child.geometry.translate(-hinge.x,-hinge.y,-hinge.z); });
      leaf.position.copy(hinge);
      leaf.userData.hingeWorld = hinge.clone();
      leaf.userData.originalPosition = hinge.clone();
      leaf.userData.hingeAxis = [0,1,0];
      doors.push(leaf);
    });
    if (stageIndex >= 4 && library) {
      const signAssets = await Promise.all(LOGO_PLACEMENTS.map(sign => new SVGLoader().loadAsync(`${options.assetBase ?? '/'}brands/${sign.id}.svg`)));
      const gradient = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'].map(color => new THREE.Color(color));
      LOGO_PLACEMENTS.forEach((sign, index) => {
        const parent = parts.get(sign.parent)!;
        const hinge = (parent.userData.hingeWorld as THREE.Vector3 | undefined) ?? new THREE.Vector3();
        const metadata = EXTERNAL_LINKS[sign.id];
        const group = part(metadata.partId, metadata.label, parent);
        group.userData.explodeWithParent = true;
        signAssets[index].paths.forEach((path, layer) => {
          if (sign.id === 'kick' && layer > 0) return; // Exclude the legacy BETA annotation.
          const colored = sign.id === 'instagram' && layer === 0;
          const ink = new THREE.MeshBasicMaterial({ color: colored ? '#ffffff' : path.color, vertexColors: colored, side: THREE.DoubleSide, toneMapped: false });
          materials.add(ink);
          path.toShapes().forEach((shape, shapeIndex) => {
            const geometry = new THREE.ShapeGeometry(shape, 16);
            const position = geometry.getAttribute('position'), colors = new Float32Array(position.count * 3);
            for (let i = 0; i < position.count; i++) {
              const sx = position.getX(i), sy = position.getY(i);
              if (colored) {
                const t = THREE.MathUtils.clamp((sx / 100 + .9 * (1 - sy / 100)) / 1.9, 0, 1) * 4;
                const a = Math.min(3, Math.floor(t));
                const color = gradient[a].clone().lerp(gradient[a + 1], t - a);
                colors.set(color.toArray(), i * 3);
              }
              const scale = sign.width / sign.svgWidth;
              const p = referencePoint(sign.x + (sx - sign.svgWidth / 2) * scale, sign.y + (sy - sign.svgHeight / 2) * scale, sign.z + layer * LOGO_LAYER_GAP).sub(hinge);
              position.setXYZ(i, p.x, p.y, p.z);
            }
            if (colored) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.computeVertexNormals();
            const mesh = addMesh(group, `${sign.id}-sign-${layer}-${shapeIndex}`, geometry, ink);
            mesh.castShadow = false; mesh.receiveShadow = false;
          });
        });
      });
    }
    const threshold = part('threshold', 'Metal threshold and weatherstrip', entrance);
    profile(threshold, 'door-threshold', [[537,718],[781,718],[781,724],[537,724]], .026, .30, aluminum, aluminum);
  }

  if (stageIndex >= 2) {
    doors.forEach((leaf, index) => {
      const hardware = part(index ? 'door-hardware-east' : 'door-hardware', 'Brushed pull bars, hinges and locks', leaf);
      hardware.userData.explodeWithParent = true;
      const handle = part(index ? 'door-handle-east' : 'door-handle-west', `${index ? 'Right' : 'Left'} door pull handle`, hardware);
      handle.userData.explodeWithParent = true;
      const hinge = leaf.userData.hingeWorld as THREE.Vector3;
      const point = (x: number,y: number,z: number) => referencePoint(x,y,z).sub(hinge);
      const handleX = index ? 670 : 651;
      roundedBox(handle,`pull-${index}-mounting-plate`,[.069,.398,.012],point(handleX,566,-.059),aluminum,.003);
      roundedBox(handle,`pull-${index}-vertical-bar`,[.028,.335,.031],point(handleX,566,.031),aluminum,.005);
      for (const py of [550.5,581.5]) roundedBox(handle,`pull-${index}-standoff-${py}`,[.034,.032,.090],point(handleX,py,-.009),aluminum,.004);
      doorHandles.push({ id: index ? 'east' : 'west', leaf, handle, openAngle: THREE.MathUtils.degToRad(index ? 14 : -14) });
      const lock=addMesh(hardware,`lock-cylinder-${index}`,new THREE.CylinderGeometry(.023,.023,.014,20),aluminum);
      lock.rotation.x=Math.PI/2;
      lock.position.copy(point(index?667:654,600,-.058));
      roundedBox(hardware,`lock-slot-${index}`,[.005,.022,.002],point(index?667:654,600,-.048),rubber,.001);
      const hingeX=index?775:547;
      for(const py of [469,575,677]){
        const cylinder=addMesh(hardware,`hinge-${index}-${py}`,new THREE.CylinderGeometry(.017,.017,.088,14),aluminum);
        cylinder.position.copy(point(hingeX,py,-.092));
        roundedBox(hardware,`hinge-leaf-${index}-${py}`,[.052,.075,.012],point(hingeX+(index?-1.8:1.8),py,-.067),aluminum,.0015);
      }
      const fasteners=part(index?'fastener-heads-east':'fastener-heads','Countersunk door fixings',hardware);
      fasteners.userData.explodeWithParent=true;
      const screwPositions: [number,number][] = [[handleX,548],[handleX,584],[hingeX,466],[hingeX,472],[hingeX,572],[hingeX,578],[hingeX,674],[hingeX,680],[index?767:554,445],[index?767:554,710]];
      const screwGeo=new THREE.CylinderGeometry(.006,.0068,.0035,10);
      screwGeo.rotateX(Math.PI/2);
      const screws=new THREE.InstancedMesh(screwGeo,aluminum,screwPositions.length);
      screws.name=`door-${index}-screw-heads`;
      screws.userData={partId:fasteners.userData.partId,explodeWithParent:true};
      screws.castShadow=true;
      const matrix=new THREE.Matrix4();
      screwPositions.forEach(([x,y],i)=>{ matrix.makeTranslation(point(x,y,-.049)); screws.setMatrixAt(i,matrix); });
      screws.instanceMatrix.needsUpdate=true;
      fasteners.add(screws); meshes.push(screws); geometries.add(screwGeo);
    });
    const coping=parts.get('coping')!;
    for(let px=65;px<1320;px+=63){
      const points=layout.roofline;
      let i=1; while(i<points.length-1&&points[i][0]<px)i++;
      const a=points[i-1],b=points[i];
      const py=THREE.MathUtils.lerp(a[1],b[1],(px-a[0])/(b[0]-a[0]));
      roundedBox(coping,`coping-seam-${px}`,[.006,.047,.19],referencePoint(px,py+4,.18),aluminum,.001);
    }
  }

  const paving = part('paving', 'Concrete sidewalk and curb');
  const groundHeight = (x:number) => {
    const px=x/.01+674.5;
    const base=[[0,694],[40,695],[116,707],[169,711],[467,719],[535,724],[787,724],[854,724],[1140,720],[1210,713],[1244,711],[1295,708],[1349,700]];
    let i=1; while(i<base.length-1&&base[i][0]<px)i++;
    const a=base[i-1],b=base[i];
    const y=THREE.MathUtils.lerp(a[1],b[1],THREE.MathUtils.clamp((px-a[0])/(b[0]-a[0]),0,1));
    return (724-y)*.01;
  };
  if(stageIndex<2) box(paving, 'sidewalk-slab', [40, .22, 2.55], [0, -.13, 1.0], concrete);
  else {
    box(paving,'continuous-sidewalk-foundation',[40,.18,2.55],[0,-.21,1],concrete);
    for(let i=-15;i<15;i++){
      const x=i*1.16+.58;
      const geo=new THREE.BoxGeometry(1.153,.22,2.55,2,1,2);
      const p=geo.getAttribute('position');
      for(let j=0;j<p.count;j++) p.setY(j,p.getY(j)+groundHeight(p.getX(j)+x));
      geo.computeVertexNormals();
      const slab=addMesh(paving,`concrete-slab-${i+15}`,geo,concrete);
      slab.position.set(x,-.13,1);
    }
    const cover=addMesh(paving,'round-service-cover',new THREE.CylinderGeometry(.21,.21,.016,48),concrete);
    cover.position.set(.25,.005+groundHeight(.25),1.74);
    const rim=addMesh(paving,'service-cover-seam',new THREE.TorusGeometry(.213,.003,6,48),inside);
    rim.rotation.x=-Math.PI/2; rim.position.set(.25,.011+groundHeight(.25),1.74);
  }
  const curb = part('curb', 'Weathered curb', paving);
  if(stageIndex<2) box(curb, 'curb-body', [40, .22, .27], [0, -.18, 2.4], concrete);
  else for(let i=-17;i<17;i++){
    const x=i*1.04+.52;
    const geo=new RoundedBoxGeometry(1.034,.24,.27,2,.013);
    const p=geo.getAttribute('position');
    for(let j=0;j<p.count;j++) p.setY(j,p.getY(j)+groundHeight(p.getX(j)+x));
    geo.computeVertexNormals();
    const block=addMesh(curb,`curb-stone-${i+17}`,geo,concrete);
    block.position.set(x,-.155,2.40);
  }
  const road = part('road', 'Asphalt roadway', paving);
  const roadMesh = box(road, 'asphalt-ground', [180, .1, 150], [0, -.35, 15], asphalt);
  // A flat road receives architectural shadows; it does not cast onto itself.
  roadMesh.castShadow = false;

  root.updateMatrixWorld(true);
  // UV1 is world-scaled PBR detail. UV0 stays the baked reference projection.
  meshes.forEach(mesh=>{
    const position=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal');
    const coords=new Float32Array(position.count*2);
    const p=new THREE.Vector3(),n=new THREE.Vector3();
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix);
      if(Math.abs(n.y)>.5){ coords[i*2]=p.x;coords[i*2+1]=p.z; }
      else { coords[i*2]=Math.abs(n.x)>.5?p.z:p.x;coords[i*2+1]=p.y; }
    }
    mesh.geometry.setAttribute('uv1',new THREE.BufferAttribute(coords,2));
  });
  root.userData.sculptRuntime = {
    parts, meshes, doors, doorHandles, stage, environment:library?.environment,
    dispose() {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      library?.textures.forEach(t=>t.dispose());
      root.removeFromParent();
    },
  } satisfies DojoRuntime;
  root.updateMatrixWorld(true);
  return root;
}
