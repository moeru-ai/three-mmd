import type { BufferGeometry, Material } from 'three'

import { SkinnedMesh } from 'three'

/** @experimental */
export const buildMesh = (
  geometry: BufferGeometry,
  materials: Material[],
): SkinnedMesh => {
  return new SkinnedMesh(geometry, materials)
}
