/**
 * Physics strategy factory and interface.
 * Default is spring-bone backed by @pixiv/three-vrm-springbone; plugins can override buildPhysics via loader deps.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { Grant } from './build-grants'

/** Default physics factory. Plugins can override to swap spring bone with other implementations. */
export const buildPhysics = (_: BuildPhysicsOptions): PhysicsStrategy => ({
  name: 'none',
  update: () => {},
})

export interface BuildPhysicsOptions {
  grants: Grant[]
  iks: IK[]
  mesh: SkinnedMesh
  pmx: PmxObject
}

export interface PhysicsStrategy<THelpers = unknown> {
  createPhysicsHelpers?: () => THelpers
  dispose?: () => void
  name: string
  setScalar?: (scale: number) => void
  update: (delta: number) => void
}
