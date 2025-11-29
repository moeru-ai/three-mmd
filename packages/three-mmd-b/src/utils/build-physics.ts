/**
 * Physics strategy factory and interface.
 * Default is spring-bone backed by @pixiv/three-vrm-springbone; plugins can override buildPhysics via loader deps.
 */
// packages/three-mmd-b/src/utils/build-physics.ts
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'
import type { SkinnedMesh } from 'three'

import { createSpringBonePhysics } from '../physics/spring-bone-physics'
import type { Grant } from './build-grants'

export interface PhysicsStrategy<THelpers = unknown> {
  name: string
  createPhysicsHelpers?: () => THelpers
  dispose?: () => void
  setScale?: (scale: number) => void
  update: (delta: number) => void
}

export interface BuildPhysicsOptions {
  grants: Grant[]
  iks: IK[]
  mesh: SkinnedMesh
  pmx: PmxObject
}

/** Default physics factory. Plugins can override to swap spring bone with other implementations. */
export const buildPhysics = (opts: BuildPhysicsOptions): PhysicsStrategy =>
  createSpringBonePhysics(opts)

export { createSpringBonePhysics }
