import type { BufferGeometry } from 'three'

import { SkinnedMesh } from 'three'

import type { MMDToonMaterial } from '../material/mmd-toon-material'

/** @experimental */
export const buildMesh = (
  geometry: BufferGeometry,
  materials: MMDToonMaterial[],
): SkinnedMesh => {
  return new SkinnedMesh(geometry, materials)
}
