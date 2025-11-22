import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

/** @experimental */
export interface MMD {
  grants: Grant[]
  iks: IK[]
  mesh: SkinnedMesh
}

export const buildMMD = (pmx: PmxObject, resourcePath: string): MMD => ({
  grants: buildGrants(pmx),
  iks: buildIK(pmx),
  mesh: buildMesh(pmx, resourcePath),
})
