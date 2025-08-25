import type { Bone, MeshBasicMaterial, SkinnedMesh, Vector3 } from 'three'

import { Object3D } from 'three'

import type { ResourceManager } from './mmd-physics/resource-manager'

export interface MMDPhysicsParameter {
  gravity?: Vector3
  maxStepNum?: number
  unitStep?: number
}

export class Constraint {
  bodyA: RigidBody

  bodyB: RigidBody
  manager: ResourceManager
  mesh: SkinnedMesh
  params: object
  world: object
  constructor(
    mesh: SkinnedMesh,
    world: object,
    bodyA: RigidBody,
    bodyB: RigidBody,
    params: object,
    manager: ResourceManager,
  )
}

export class MMDPhysics {
  bodies: RigidBody[]
  constraints: Constraint[]
  gravity: Vector3
  manager: ResourceManager
  maxStepNum: number
  mesh: SkinnedMesh
  unitStep: number
  world: null
  constructor(
    mesh: SkinnedMesh,
    rigidBodyParams: object[],
    constraintParams?: object[],
    params?: MMDPhysicsParameter,
  )

  createHelper(): MMDPhysicsHelper
  reset(): this
  setGravity(gravity: Vector3): this
  update(delta: number): this
  warmup(cycles: number): this
}

export class MMDPhysicsHelper extends Object3D {
  materials: [MeshBasicMaterial, MeshBasicMaterial, MeshBasicMaterial]
  mesh: SkinnedMesh
  physics: MMDPhysics

  constructor(mesh: SkinnedMesh, physics: MMDPhysics)
  dispose(): void
}

export class RigidBody {
  body: object
  bone: Bone
  boneOffsetForm: object
  boneOffsetFormInverse: object
  manager: ResourceManager

  mesh: SkinnedMesh
  params: object
  world: object
  constructor(mesh: SkinnedMesh, world: object, params: object, manager: ResourceManager)

  reset(): this
  updateBone(): this
  updateFromBone(): this
}
