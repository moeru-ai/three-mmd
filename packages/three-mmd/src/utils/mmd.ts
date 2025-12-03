/**
 * MMD model shell: holds parsed PMX, skinned mesh, IK/grants, and pluggable physics strategy.
 * Lifecycle methods update scale/physics, helpers expose collider/joint visualization when available.
 */
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { Grant } from './build-grants'
import type { PhysicsStrategy } from './build-physics'

export class MMD {
  public grants: Grant[] = []
  public iks: IK[] = []
  public mesh: SkinnedMesh
  public physics: PhysicsStrategy | undefined
  public scale: number

  constructor(mesh: SkinnedMesh, grants: Grant[], iks: IK[], physics: PhysicsStrategy | undefined) {
    this.grants = grants
    this.iks = iks
    this.mesh = mesh
    this.scale = 1
    this.physics = physics
  }

  public createPhysicsHelpers() {
    if (this.physics)
      return this.physics.createPhysicsHelpers?.()
  }

  // https://github.com/pixiv/three-vrm/blob/dev/guides/spring-bones-on-scaled-models.md
  public setScalar(scale: number) {
    if (this.scale === scale)
      return
    this.scale = scale
    this.mesh.scale.setScalar(scale)
    // Physics scaling
    this.physics?.setScalar?.(this.scale)
  }

  public update(delta: number) {
    if (this.physics)
      return this.physics.update(delta)
  }
}
