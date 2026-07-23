import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
/**
 * MMD model shell: holds parsed PMX, skinned mesh, IK/grants, and pluggable physics strategy.
 * Lifecycle methods update scale/physics, helpers expose collider/joint visualization when available.
 */
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { PhysicsFactory, PhysicsService } from '../physics/physics-service'
import type { Grant } from './build-grants'

import { GrantSolver } from '../physics/grant-solver'
import { processBones } from '../physics/process-bones'

const boneProcessors = new WeakMap<MMD, ReturnType<typeof processBones>>()

/** Clears the cached mixer pose before a static pose is applied. */
export const resetMMDAnimationPose = (mmd: MMD) =>
  boneProcessors.get(mmd)?.clearBones()

export class MMD {
  public grants: Grant[] = []
  public grantSolver: GrantSolver
  public iks: IK[] = []
  public ikSolver: CCDIKSolver
  public mesh: SkinnedMesh
  public physics?: PhysicsService
  public pmx: PmxObject
  public scale: number

  constructor(pmx: PmxObject, mesh: SkinnedMesh, grants: Grant[], iks: IK[]) {
    this.pmx = pmx
    this.grants = grants
    this.iks = iks
    this.mesh = mesh
    this.scale = 1
    this.ikSolver = new CCDIKSolver(mesh, iks)
    this.grantSolver = new GrantSolver(mesh, grants)
    boneProcessors.set(this, processBones())
  }

  /**
   * Restores the skeletal pose sampled by the previous animation frame.
   *
   * Call this immediately before the animation mixer updates the mesh.
   */
  public beforeUpdate() {
    boneProcessors.get(this)!.restoreBones(this.mesh)
  }

  public dispose() {
    this.physics?.dispose?.()
    this.physics = undefined
    boneProcessors.delete(this)
  }

  public setPhysics(createPhysics: PhysicsFactory) {
    if (this.physics)
      throw new Error('MMD: Physics has already been installed.')

    const physics = createPhysics(this)
    this.physics = physics
    physics.setScalar?.(this.scale)
  }

  public setScalar(scale: number) {
    if (this.scale === scale)
      return

    this.scale = scale
    this.mesh.scale.setScalar(scale)
    this.mesh.updateMatrixWorld(true)
    this.physics?.setScalar?.(scale)
  }

  /**
   * Applies MMD-specific pose processing after an animation mixer updates the mesh.
   *
   * The ordering is significant: the mixer pose is cached before IK and append
   * transforms mutate the bones, so the next frame can start from an unmodified
   * animation pose.
   */
  public update(delta: number) {
    boneProcessors.get(this)!.saveBones(this.mesh)
    this.mesh.updateMatrixWorld(true)
    this.ikSolver.update(delta)
    this.grantSolver.update()
    this.physics?.update(delta)
  }
}
