/**
 * Physics strategy factory and interface.
 * Default is spring-bone backed by @pixiv/three-vrm-springbone; plugins can override buildPhysics via loader deps.
 */
// packages/three-mmd-b/src/utils/build-physics.ts
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

import type { Grant } from './build-grants'
import { createSpringBonePhysics } from '../physics/spring-bone-physics'

export interface PhysicsStrategy<THelpers = unknown> {
  name: string
  update(delta: number): void
  setScale?(scale: number): void
  dispose?(): void
  createPhysicsHelpers?(): THelpers
}

export interface BuildPhysicsOptions {
  pmx: PmxObject
  mesh: SkinnedMesh
  grants: Grant[]
  iks: IK[]
}

/** Default physics factory. Plugins can override to swap spring bone with other implementations. */
export const buildPhysics = (opts: BuildPhysicsOptions): PhysicsStrategy =>
  createSpringBonePhysics(opts)

export { createSpringBonePhysics }
