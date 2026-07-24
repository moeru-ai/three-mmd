import type { BufferGeometry } from 'three'

import type { MMDToonMaterial } from '../materials/mmd-toon-material'

import { SkinnedMesh } from 'three'

/** @experimental */
export const buildMesh = (
  geometry: BufferGeometry,
  materials: MMDToonMaterial[],
): SkinnedMesh => {
  return new SkinnedMesh(geometry, materials)
}
