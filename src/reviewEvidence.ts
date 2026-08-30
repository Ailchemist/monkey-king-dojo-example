import * as THREE from 'three';
import type { DojoRuntime } from './createDojoModel';

/** Actual built geometry for local QA. This module is omitted from production. */
export function collectEvidence(model: THREE.Group, runtime: DojoRuntime) {
  model.updateMatrixWorld(true);
  const meshes: Record<string, unknown>[] = [];
  const openSurfaces: string[] = [];
  for (const mesh of runtime.meshes) {
    if (mesh.geometry instanceof THREE.ShapeGeometry) { openSurfaces.push(mesh.name); continue; }
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const count = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    for (let instance = 0; instance < count; instance++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh instanceof THREE.InstancedMesh) { const local = new THREE.Matrix4(); mesh.getMatrixAt(instance, local); matrix.multiply(local); }
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
      const vertices: number[][] = [], normals: number[][] = [];
      const vector = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        vertices.push(vector.fromBufferAttribute(position, i).applyMatrix4(matrix).toArray());
        normals.push(vector.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize().toArray());
      }
      meshes.push({ id: count > 1 ? `${mesh.name}-${instance}` : mesh.name, vertices, normals, indices: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, i) => i) });
    }
  }
  const manifest = {
    model: 'monkey-king-dojo',
    parts: [...runtime.parts].map(([id, part]) => {
      let triangles = 0;
      part.traverse(object => { if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1); });
      return { name: id, kind: 'part', module: id, triangles, parent: part.parent?.userData.partId ?? null };
    }),
    unnamedMeshes: runtime.meshes.filter(mesh => !mesh.userData.partId).length,
    integralMeshes: runtime.meshes.length,
  };
  const measured = Object.fromEntries([...runtime.parts].map(([id, part]) => {
    const box = new THREE.Box3().setFromObject(part);
    return [id, { position: part.getWorldPosition(new THREE.Vector3()).toArray(), bounds: { min: box.min.toArray(), max: box.max.toArray() } }];
  }));
  return { manifest, geometry: { meshes, openSurfaces, note: 'All closed solids, including every fastener instance. The listed vector vinyl surfaces are intentionally open and excluded from closed-volume ray-parity tests.' }, measured };
}
