import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
/**
 * MMD model shell: holds parsed PMX, skinned mesh, IK/grants, and pluggable physics strategy.
 * Lifecycle methods update scale/physics, helpers expose collider/joint visualization when available.
 */
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { PhysicsFactory, PhysicsService } from '../physics/physics-service'
import type { Grant } from './build-grants'

export class MMD {
  public grants: Grant[] = []
  public iks: IK[] = []
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
  }

  public createHelper<T>(): T | undefined {
    return (this.physics as PhysicsService<T> | undefined)?.createHelper?.()
  }

  public setPhysics<T>(createPhysics: PhysicsFactory<T>) {
    const physics = createPhysics(this)
    this.physics = physics
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
    if (!this.physics)
      return

    this.physics.update(delta)
  }
}
