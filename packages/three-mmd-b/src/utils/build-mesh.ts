import type { BufferGeometry } from 'three'
import type { MMDToonMaterial } from '../materials/mmd-toon-material'

import { SkinnedMesh } from 'three'

/** @experimental */
export const buildMesh = (
  geometry: BufferGeometry,
  materials: MMDToonMaterial[],
): SkinnedMesh => {
  const mesh = new SkinnedMesh(geometry, materials)
  return mesh
}
