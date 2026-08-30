import * as THREE from 'three';

// Small geometric capitals, drawn as real contours so the pillar signs have
// beveled edges and depth without a font download or a raster text overlay.
const polygon = (points: number[][]) => {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return shape;
};

function capital(letter: string): THREE.Shape {
  if (letter === 'O') {
    const shape = new THREE.Shape();
    shape.absellipse(.36, .5, .36, .5, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(.36, .5, .19, .33, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    return shape;
  }
  if (letter === 'C') {
    const shape = new THREE.Shape();
    const start = .24 * Math.PI, end = 1.76 * Math.PI;
    shape.absellipse(.36, .5, .36, .5, start, end, false, 0);
    shape.lineTo(.36 + .19 * Math.cos(end), .5 + .33 * Math.sin(end));
    shape.absellipse(.36, .5, .19, .33, end, start, true, 0);
    shape.closePath();
    return shape;
  }
  if (letter === 'P' || letter === 'R') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0).lineTo(.17, 0).lineTo(.17, .40);
    if (letter === 'R') shape.lineTo(.32, .40).lineTo(.54, 0).lineTo(.74, 0).lineTo(.49, .44);
    else shape.lineTo(.38, .40);
    shape.bezierCurveTo(.62, .42, .70, .54, .70, .71);
    shape.bezierCurveTo(.70, .90, .58, 1, .38, 1);
    shape.lineTo(0, 1).closePath();
    const hole = new THREE.Path();
    hole.moveTo(.17, .57).lineTo(.17, .83).lineTo(.36, .83);
    hole.bezierCurveTo(.48, .83, .52, .79, .52, .70);
    hole.bezierCurveTo(.52, .61, .47, .57, .36, .57);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  }
  if (letter === 'A') {
    const shape = polygon([[0, 0], [.18, 0], [.27, .27], [.53, .27], [.62, 0], [.80, 0], [.49, 1], [.31, 1]]);
    const hole = new THREE.Path();
    hole.moveTo(.40, .76).lineTo(.30, .44).lineTo(.50, .44).closePath();
    shape.holes.push(hole);
    return shape;
  }
  if (letter === 'D') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0).lineTo(.31, 0).bezierCurveTo(.65, 0, .77, .18, .77, .5)
      .bezierCurveTo(.77, .82, .65, 1, .31, 1).lineTo(0, 1).closePath();
    const hole = new THREE.Path();
    hole.moveTo(.18, .17).lineTo(.18, .83).lineTo(.31, .83)
      .bezierCurveTo(.50, .83, .59, .74, .59, .5).bezierCurveTo(.59, .26, .50, .17, .31, .17).closePath();
    shape.holes.push(hole);
    return shape;
  }
  const outlines: Record<string, number[][]> = {
    T: [[0, 1], [.76, 1], [.76, .83], [.47, .83], [.47, 0], [.29, 0], [.29, .83], [0, .83]],
    F: [[0, 0], [.18, 0], [.18, .42], [.57, .42], [.57, .59], [.18, .59], [.18, .83], [.66, .83], [.66, 1], [0, 1]],
    L: [[0, 1], [.18, 1], [.18, .17], [.64, .17], [.64, 0], [0, 0]],
    I: [[0, 1], [.44, 1], [.44, .84], [.31, .84], [.31, .16], [.44, .16], [.44, 0], [0, 0], [0, .16], [.13, .16], [.13, .84], [0, .84]],
    N: [[0, 0], [.17, 0], [.17, .69], [.57, 0], [.75, 0], [.75, 1], [.58, 1], [.58, .31], [.18, 1], [0, 1]],
    E: [[0, 0], [.68, 0], [.68, .17], [.18, .17], [.18, .43], [.60, .43], [.60, .60], [.18, .60], [.18, .83], [.68, .83], [.68, 1], [0, 1]],
    H: [[0, 0], [.18, 0], [.18, .43], [.55, .43], [.55, 0], [.73, 0], [.73, 1], [.55, 1], [.55, .60], [.18, .60], [.18, 1], [0, 1]],
    M: [[0, 0], [.18, 0], [.18, .70], [.40, .28], [.54, .28], [.76, .70], [.76, 0], [.94, 0], [.94, 1], [.72, 1], [.47, .52], [.22, 1], [0, 1]],
  };
  if (!outlines[letter]) throw new Error(`Unsupported pillar letter: ${letter}`);
  return polygon(outlines[letter]);
}

export function createSignLetter(letter: string, capHeight: number) {
  const geometry = new THREE.ShapeGeometry(capital(letter), 16);
  geometry.scale(capHeight, capHeight, 1);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, 0);
  return geometry;
}

export function createPillarLetter(letter: string, capHeight = .26) {
  const geometry = new THREE.ExtrudeGeometry(capital(letter), {
    depth: .032, bevelEnabled: true, bevelSize: .007, bevelThickness: .007,
    bevelSegments: 2, curveSegments: 10, steps: 1,
  });
  geometry.scale(capHeight, capHeight, capHeight);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, 0);
  return geometry;
}
