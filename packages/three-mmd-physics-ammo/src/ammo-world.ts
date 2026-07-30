/* eslint-disable new-cap */
import type Ammo from 'ammojs-typed'
import type { Vector3 } from 'three'

import type { AmmoModule } from './ammo-runtime'

const FIXED_TIME_STEP = 1 / 60
const MAX_STEPS = 5

export class AmmoWorld {
  public readonly world: Ammo.btDiscreteDynamicsWorld

  private readonly ammo: AmmoModule
  private readonly broadphase: Ammo.btDbvtBroadphase
  private readonly collisionConfiguration: Ammo.btDefaultCollisionConfiguration
  private readonly dispatcher: Ammo.btCollisionDispatcher
  private readonly solver: Ammo.btSequentialImpulseConstraintSolver
  private readonly temporaryVector: Ammo.btVector3

  public constructor(ammo: AmmoModule) {
    this.ammo = ammo
    this.collisionConfiguration = new ammo.btDefaultCollisionConfiguration()
    this.dispatcher = new ammo.btCollisionDispatcher(this.collisionConfiguration)
    this.broadphase = new ammo.btDbvtBroadphase()
    this.solver = new ammo.btSequentialImpulseConstraintSolver()
    this.world = new ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration,
    )
    this.temporaryVector = new ammo.btVector3(0, -9.8, 0)
    this.world.setGravity(this.temporaryVector)
  }

  public dispose() {
    this.ammo.destroy(this.temporaryVector)
    this.ammo.destroy(this.world)
    this.ammo.destroy(this.solver)
    this.ammo.destroy(this.broadphase)
    this.ammo.destroy(this.dispatcher)
    this.ammo.destroy(this.collisionConfiguration)
  }

  public setGravity(gravity: Vector3, scalingFactor: number) {
    this.temporaryVector.setValue(
      gravity.x * scalingFactor,
      gravity.y * scalingFactor,
      gravity.z * scalingFactor,
    )
    this.world.setGravity(this.temporaryVector)
  }

  public step(delta: number) {
    this.world.stepSimulation(delta, MAX_STEPS, FIXED_TIME_STEP)
  }
}
