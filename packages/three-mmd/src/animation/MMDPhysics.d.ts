import type { Bone, Euler, Matrix4, MeshBasicMaterial, Quaternion, SkinnedMesh, Vector3 } from 'three'

import { Object3D } from 'three'

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

export class ResourceManager {
  quaternions: object[]
  threeEulers: Euler[]
  threeMatrix4s: Matrix4[]
  threeQuaternions: Quaternion[]
  threeVector3s: Vector3[]
  transforms: object[]
  vector3s: object[]
  constructor()

  addVector3(v1: object, v2: object): object
  allocQuaternion(): void
  allocThreeEuler(): void
  allocThreeMatrix4(): void
  allocThreeQuaternion(): void
  allocThreeVector3(): void
  allocTransform(): void
  allocVector3(): void
  columnOfMatrix3(m: object, i: number): object
  copyOrigin(t1: object, t2: object): void
  dotVectors3(v1: object, v2: object): number
  freeQuaternion(q: object): void
  freeThreeEuler(e: Euler): void
  freeThreeMatrix4(m: Matrix4): void
  freeThreeQuaternion(q: Quaternion): void
  freeThreeVector3(v: Vector3): void
  freeTransform(t: object): void
  freeVector3(v: object): void
  getBasis(t: object): object
  getBasisAsMatrix3(t: object): object
  getOrigin(t: object): object
  inverseTransform(t: object): object
  matrix3ToQuaternion(m: object): object
  multiplyMatrices3(m1: object, m2: object): object
  multiplyMatrix3ByVector3(m: object, v: object): object
  multiplyTransforms(t1: object, t2: object): object
  negativeVector3(v: object): object
  quaternionToMatrix3(q: object): object
  rowOfMatrix3(m: object, i: number): object
  setBasis(t: object, q: object): void
  setBasisFromArray3(t: object, a: number[]): void
  setBasisFromMatrix3(t: object, m: object): void
  setBasisFromThreeQuaternion(t: object, a: Quaternion): void
  setIdentity(): void
  setOrigin(t: object, v: object): void
  setOriginFromArray3(t: object, a: number[]): void
  setOriginFromThreeVector3(t: object, v: Vector3): void
  transposeMatrix3(m: object): object
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
