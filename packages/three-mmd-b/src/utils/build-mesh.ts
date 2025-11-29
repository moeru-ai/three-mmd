import { type BufferGeometry, SkinnedMesh } from 'three'

import type { MMDToonMaterial } from '../materials/mmd-toon-material'

/** @experimental */
export const buildMesh = (
  geometry: BufferGeometry,
  materials: MMDToonMaterial[],
): SkinnedMesh => {
  const mesh = new SkinnedMesh(geometry, materials)
  return mesh
}
