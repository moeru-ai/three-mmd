import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

import { Skeleton, SkinnedMesh } from 'three'

import { buildBones } from './build-bones'
import { buildGeometry } from './build-geometry'
import { buildMaterial } from './build-material'

/** @experimental */
export const buildMesh = (
  pmx: PmxObject,
  resourcePath: string,
): SkinnedMesh => {
  const geometry = buildGeometry(pmx)
  const material = buildMaterial(
    pmx,
    geometry,
    resourcePath,
  )

  const mesh = new SkinnedMesh(geometry, material)

  const skeleton = new Skeleton(buildBones(pmx, mesh))
  mesh.bind(skeleton)

  return mesh
}
