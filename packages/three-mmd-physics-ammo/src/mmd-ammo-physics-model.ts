/* eslint-disable new-cap */
import type { MMD, PmxObject } from '@moeru/three-mmd'
import type Ammo from 'ammojs-typed'
import type { Bone } from 'three'

import type { AmmoModule } from './ammo-runtime'

import { PmxObject as Pmx } from '@moeru/three-mmd'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { AmmoWorld } from './ammo-world'

const CF_KINEMATIC_OBJECT = 2
const CF_NO_CONTACT_RESPONSE = 4
const DISABLE_DEACTIVATION = 4
const BT_CONSTRAINT_STOP_ERP = 2

interface RigidBodyResource {
  body: Ammo.btRigidBody
  bodyOffset: Matrix4
  bodyOffsetInverse: Matrix4
  bone: Bone | null
  constructionInfo: Ammo.btRigidBodyConstructionInfo
  kinematicToggle: boolean
  motionState: Ammo.btDefaultMotionState
  params: PmxObject.RigidBody
  physicsMode: PmxObject.RigidBody.PhysicsMode
  shape: Ammo.btCollisionShape
  temporalKinematic: boolean
}

const normalizeAngle = (value: number): number => {
  const twoPi = Math.PI * 2
  const normalized = value % twoPi
  if (normalized < -Math.PI)
    return normalized + twoPi
  if (normalized > Math.PI)
    return normalized - twoPi
  return normalized
}

export class MmdAmmoPhysicsModel {
  public readonly bodies: Array<null | RigidBodyResource>
  public readonly scalingFactor: number

  private readonly ammo: AmmoModule
  private readonly bodyModelTransforms: Matrix4[]
  private readonly bodyStates: Uint8Array
  private readonly constraints: Ammo.btGeneric6DofSpringConstraint[] = []
  private disposed = false
  private gravity = new Vector3(0, -98, 0)
  private readonly inversePhysicsRootMatrix = new Matrix4()
  private readonly inverseRootMatrix = new Matrix4()
  private readonly mmd: MMD
  private readonly physicsRootMatrix = new Matrix4()
  private readonly rootQuaternion = new Quaternion()
  private readonly temporaryAmmoQuaternion: Ammo.btQuaternion
  private readonly temporaryAmmoTransform: Ammo.btTransform
  private readonly temporaryAmmoVector: Ammo.btVector3
  private readonly temporaryMatrixA = new Matrix4()
  private readonly temporaryMatrixB = new Matrix4()
  private readonly temporaryMatrixC = new Matrix4()
  private readonly temporaryPosition = new Vector3()
  private readonly temporaryPositionB = new Vector3()
  private readonly temporaryQuaternion = new Quaternion()
  private readonly temporaryScale = new Vector3()
  private readonly world: AmmoWorld

  public constructor(
    ammo: AmmoModule,
    mmd: MMD,
  ) {
    this.ammo = ammo
    this.mmd = mmd
    this.world = new AmmoWorld(ammo)
    this.readRootTransform()
    this.scalingFactor = 1
    this.bodies = []
    this.bodies.length = mmd.pmx.rigidBodies.length
    this.bodies.fill(null)
    this.bodyModelTransforms = Array.from(
      { length: mmd.pmx.rigidBodies.length },
      () => new Matrix4(),
    )
    this.bodyStates = new Uint8Array(mmd.pmx.rigidBodies.length).fill(1)
    this.temporaryAmmoVector = new ammo.btVector3(0, 0, 0)
    this.temporaryAmmoQuaternion = new ammo.btQuaternion(0, 0, 0, 1)
    this.temporaryAmmoTransform = new ammo.btTransform()
    this.temporaryAmmoTransform.setIdentity()

    this.buildRigidBodies()
    this.buildConstraints()
    this.world.setGravity(this.gravity, this.scalingFactor)
    this.initialize()
  }

  public commitBodyStates(states: Uint8Array) {
    const count = Math.min(states.length, this.bodies.length)
    for (let i = 0; i < count; i++) {
      const resource = this.bodies[i]
      if (!resource || resource.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone)
        continue

      const state = states[i]
      this.bodyStates[i] = state
      this.setKinematicToggle(resource, state === 0)
    }
  }

  public dispose() {
    if (this.disposed)
      return

    this.disposed = true

    for (let i = this.constraints.length - 1; i >= 0; i--) {
      const constraint = this.constraints[i]
      this.world.world.removeConstraint(constraint)
      this.ammo.destroy(constraint)
    }
    this.constraints.length = 0

    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const resource = this.bodies[i]
      if (!resource)
        continue
      this.world.world.removeRigidBody(resource.body)
      this.ammo.destroy(resource.body)
      this.ammo.destroy(resource.constructionInfo)
      this.ammo.destroy(resource.motionState)
      this.ammo.destroy(resource.shape)
      this.bodies[i] = null
    }

    this.ammo.destroy(this.temporaryAmmoTransform)
    this.ammo.destroy(this.temporaryAmmoQuaternion)
    this.ammo.destroy(this.temporaryAmmoVector)
    this.world.dispose()
  }

  /** Maps a body's unscaled simulation transform into the rendered root space. */
  public getBodyRenderMatrix(resource: RigidBodyResource, target: Matrix4) {
    this.readRootTransform()
    this.readBodyTransform(resource.body, target)
    return target
      .premultiply(this.inversePhysicsRootMatrix)
      .premultiply(this.mmd.mesh.matrixWorld)
  }

  public initialize() {
    this.readRootTransform()
    this.mmd.mesh.updateMatrixWorld(true)

    for (let i = 0; i < this.bodies.length; i++) {
      const resource = this.bodies[i]
      if (!resource)
        continue

      const transform = resource.bone
        ? this.getBodyWorldMatrixFromBone(resource, this.temporaryMatrixA)
        : this.temporaryMatrixA
            .copy(this.physicsRootMatrix)
            .multiply(this.bodyModelTransforms[i])

      this.writeBodyTransform(resource, transform)
      this.zeroBodyVelocity(resource)

      if (resource.physicsMode !== Pmx.RigidBody.PhysicsMode.FollowBone)
        this.setTemporalKinematic(resource, true)
    }
  }

  public setGravity(gravity: Vector3) {
    this.gravity.copy(gravity)
    this.world.setGravity(this.gravity, this.scalingFactor)
  }

  public syncBodies() {
    this.readRootTransform()
    this.mmd.mesh.updateMatrixWorld(true)

    for (let i = 0; i < this.bodies.length; i++) {
      const resource = this.bodies[i]
      if (!resource?.bone)
        continue

      if (
        resource.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone
        || this.bodyStates[i] === 0
      ) {
        const transform = this.getBodyWorldMatrixFromBone(resource, this.temporaryMatrixA)
        this.writeBodyTransform(resource, transform)
      }
    }
  }

  public syncBones() {
    this.readRootTransform()

    for (const resource of this.bodies) {
      if (
        !resource?.bone
        || resource.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone
      ) {
        continue
      }

      this.readBodyTransform(resource.body, this.temporaryMatrixA)
      this.worldToModelTransform(this.temporaryMatrixA, this.temporaryMatrixB)
      this.temporaryMatrixB.multiply(resource.bodyOffsetInverse)

      const bone = resource.bone
      const preservedWorldPosition = resource.physicsMode === Pmx.RigidBody.PhysicsMode.PhysicsWithBone
        ? bone.getWorldPosition(this.temporaryPositionB)
        : null

      this.modelToBoneLocal(bone, this.temporaryMatrixB, this.temporaryMatrixC)
      this.temporaryMatrixC.decompose(
        this.temporaryPosition,
        this.temporaryQuaternion,
        this.temporaryScale,
      )
      bone.quaternion.copy(this.temporaryQuaternion).normalize()

      if (preservedWorldPosition) {
        const parent = bone.parent
        if (parent)
          parent.worldToLocal(preservedWorldPosition)
        bone.position.copy(preservedWorldPosition)
      }
      else {
        bone.position.copy(this.temporaryPosition)
      }

      bone.updateMatrixWorld(true)
    }
  }

  public update(delta: number) {
    if (this.disposed)
      return

    this.syncBodies()
    this.world.step(delta)
    this.finishTemporalKinematics()
    this.syncBones()
  }

  private adjustPhysicsModeFromJoint(
    bodyA: RigidBodyResource,
    bodyB: RigidBodyResource,
  ) {
    if (
      bodyA.physicsMode !== Pmx.RigidBody.PhysicsMode.FollowBone
      && bodyB.physicsMode === Pmx.RigidBody.PhysicsMode.PhysicsWithBone
      && bodyB.bone?.parent === bodyA.bone
    ) {
      bodyB.physicsMode = Pmx.RigidBody.PhysicsMode.Physics
    }
    else if (
      bodyB.physicsMode !== Pmx.RigidBody.PhysicsMode.FollowBone
      && bodyA.physicsMode === Pmx.RigidBody.PhysicsMode.PhysicsWithBone
      && bodyA.bone?.parent === bodyB.bone
    ) {
      bodyA.physicsMode = Pmx.RigidBody.PhysicsMode.Physics
    }
  }

  private buildConstraints() {
    const joints = this.mmd.pmx.joints
    const rigidBodies = this.mmd.pmx.rigidBodies

    for (const joint of joints) {
      const indexA = joint.rigidbodyIndexA
      const indexB = joint.rigidbodyIndexB
      if (
        indexA < 0
        || indexA >= this.bodies.length
        || indexB < 0
        || indexB >= this.bodies.length
      ) {
        console.warn(`MMDAmmoPhysics: rigid body index out of range; skipped joint "${joint.name}".`)
        continue
      }

      const bodyA = this.bodies[indexA]
      const bodyB = this.bodies[indexB]
      if (!bodyA || !bodyB) {
        console.warn(`MMDAmmoPhysics: rigid body was not created; skipped joint "${joint.name}".`)
        continue
      }

      const jointTransform = this.composeModelTransform(
        joint.position,
        joint.rotation,
        this.scalingFactor,
        this.temporaryMatrixA,
      )
      const bodyTransformA = this.composeModelTransform(
        rigidBodies[indexA].shapePosition,
        rigidBodies[indexA].shapeRotation,
        this.scalingFactor,
        this.temporaryMatrixB,
      )
      const frameA = this.temporaryMatrixC
        .copy(bodyTransformA)
        .invert()
        .multiply(jointTransform)
        .clone()
      const bodyTransformB = this.composeModelTransform(
        rigidBodies[indexB].shapePosition,
        rigidBodies[indexB].shapeRotation,
        this.scalingFactor,
        this.temporaryMatrixB,
      )
      const frameB = this.temporaryMatrixC
        .copy(bodyTransformB)
        .invert()
        .multiply(jointTransform)

      const ammoFrameA = this.createAmmoTransform(frameA)
      const ammoFrameB = this.createAmmoTransform(frameB)
      const constraint = new this.ammo.btGeneric6DofSpringConstraint(
        bodyA.body,
        bodyB.body,
        ammoFrameA,
        ammoFrameB,
        true,
      )

      for (let axis = 0; axis < 6; axis++)
        constraint.setParam(BT_CONSTRAINT_STOP_ERP, 0.475, axis)

      for (let axis = 0; axis < 3; axis++) {
        const stiffness = joint.springPosition[axis]
        constraint.enableSpring(axis, stiffness !== 0)
        if (stiffness !== 0)
          constraint.setStiffness(axis, stiffness)
      }
      for (let axis = 0; axis < 3; axis++) {
        const stiffness = joint.springRotation[axis]
        constraint.enableSpring(axis + 3, stiffness !== 0)
        if (stiffness !== 0)
          constraint.setStiffness(axis + 3, stiffness)
      }

      this.setConstraintLimits(constraint, joint)

      // Babylon-MMD creates these joints with collision=true. Ammo's second
      // argument means "disable collisions", so the corresponding value is false.
      this.world.world.addConstraint(constraint, false)
      this.constraints.push(constraint)
      this.ammo.destroy(ammoFrameB)
      this.ammo.destroy(ammoFrameA)

      this.adjustPhysicsModeFromJoint(bodyA, bodyB)
    }
  }

  private buildRigidBodies() {
    const bones = this.mmd.mesh.skeleton.bones
    const boneIndexByName = new Map(
      bones.map((bone, index) => [bone.name, index]),
    )

    for (let i = 0; i < this.mmd.pmx.rigidBodies.length; i++) {
      const params = this.mmd.pmx.rigidBodies[i]
      const boneIndex = (
        params.boneIndex >= 0 && params.boneIndex < bones.length
          ? params.boneIndex
          : boneIndexByName.get(params.name) ?? -1
      )
      const bone: Bone | null = boneIndex >= 0 ? bones[boneIndex] : null

      if (!bone)
        console.warn(`MMDAmmoPhysics: created unmapped rigid body "${params.name}".`)

      const shapeResult = this.createShape(params)
      if (!shapeResult)
        continue

      const shapeModelTransform = this.composeModelTransform(
        params.shapePosition,
        params.shapeRotation,
        1,
        this.temporaryMatrixA,
      )
      const bodyOffset = bone
        ? this.getBodyOffsetFromBindPose(
            boneIndex,
            shapeModelTransform,
            this.temporaryMatrixB,
          ).clone()
        : shapeModelTransform.clone()

      const worldTransform = this.temporaryMatrixB
        .copy(this.physicsRootMatrix)
        .multiply(shapeModelTransform)
      const ammoTransform = this.createAmmoTransform(worldTransform)
      const motionState = new this.ammo.btDefaultMotionState(ammoTransform)
      const mass = params.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone
        ? 0
        : params.mass * this.scalingFactor
      const localInertia = new this.ammo.btVector3(0, 0, 0)
      if (mass !== 0)
        shapeResult.shape.calculateLocalInertia(mass, localInertia)

      const constructionInfo = new this.ammo.btRigidBodyConstructionInfo(
        mass,
        motionState,
        shapeResult.shape,
        localInertia,
      )
      constructionInfo.set_m_friction(params.friction)
      constructionInfo.set_m_restitution(params.repulsion)
      constructionInfo.set_m_linearDamping(params.linearDamping)
      constructionInfo.set_m_angularDamping(params.angularDamping)
      constructionInfo.set_m_additionalDamping(true)

      const body = new this.ammo.btRigidBody(constructionInfo)
      body.setDamping(params.linearDamping, params.angularDamping)
      body.setSleepingThresholds(0, 0)

      if (params.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone) {
        body.setCollisionFlags(body.getCollisionFlags() | CF_KINEMATIC_OBJECT)
        body.setActivationState(DISABLE_DEACTIVATION)
      }
      if (params.collisionMask === 0 || shapeResult.zeroVolume)
        body.setCollisionFlags(body.getCollisionFlags() | CF_NO_CONTACT_RESPONSE)

      this.world.world.addRigidBody(body, 1 << params.collisionGroup, params.collisionMask)

      this.bodies[i] = {
        body,
        bodyOffset,
        bodyOffsetInverse: bodyOffset.clone().invert(),
        bone,
        constructionInfo,
        kinematicToggle: params.physicsMode === Pmx.RigidBody.PhysicsMode.FollowBone,
        motionState,
        params,
        physicsMode: params.physicsMode,
        shape: shapeResult.shape,
        temporalKinematic: false,
      }
      this.bodyModelTransforms[i].copy(shapeModelTransform)

      this.ammo.destroy(localInertia)
      this.ammo.destroy(ammoTransform)
    }
  }

  private composeModelTransform(
    position: readonly [number, number, number],
    rotation: readonly [number, number, number],
    positionScale: number,
    target: Matrix4,
  ): Matrix4 {
    this.temporaryPosition.fromArray(position).multiplyScalar(positionScale)
    this.temporaryQuaternion.setFromEuler(
      new Euler(rotation[0], rotation[1], rotation[2], 'YXZ'),
    )
    return target.compose(
      this.temporaryPosition,
      this.temporaryQuaternion,
      this.temporaryScale.set(1, 1, 1),
    )
  }

  private createAmmoTransform(matrix: Matrix4): Ammo.btTransform {
    matrix.decompose(
      this.temporaryPosition,
      this.temporaryQuaternion,
      this.temporaryScale,
    )
    const origin = new this.ammo.btVector3(
      this.temporaryPosition.x,
      this.temporaryPosition.y,
      this.temporaryPosition.z,
    )
    const rotation = new this.ammo.btQuaternion(
      this.temporaryQuaternion.x,
      this.temporaryQuaternion.y,
      this.temporaryQuaternion.z,
      this.temporaryQuaternion.w,
    )
    const transform = new this.ammo.btTransform(rotation, origin)
    this.ammo.destroy(rotation)
    this.ammo.destroy(origin)
    return transform
  }

  private createShape(params: PmxObject.RigidBody): null | {
    shape: Ammo.btCollisionShape
    zeroVolume: boolean
  } {
    const [x, y, z] = params.shapeSize
    const scale = this.scalingFactor

    switch (params.shapeType) {
      case Pmx.RigidBody.ShapeType.Box: {
        const halfExtents = new this.ammo.btVector3(x * scale, y * scale, z * scale)
        const shape = new this.ammo.btBoxShape(halfExtents)
        this.ammo.destroy(halfExtents)
        return { shape, zeroVolume: x === 0 || y === 0 || z === 0 }
      }
      case Pmx.RigidBody.ShapeType.Capsule:
        return {
          shape: new this.ammo.btCapsuleShape(x * scale, y * scale),
          zeroVolume: x === 0 || y === 0,
        }
      case Pmx.RigidBody.ShapeType.Sphere:
        return {
          shape: new this.ammo.btSphereShape(x * scale),
          zeroVolume: x === 0,
        }
      default:
        console.warn(`MMDAmmoPhysics: unknown shape type ${String(params.shapeType)}; skipped rigid body "${params.name}".`)
        return null
    }
  }

  private finishTemporalKinematics() {
    for (const resource of this.bodies) {
      if (resource?.temporalKinematic)
        this.setTemporalKinematic(resource, false)
    }
  }

  private getBodyOffsetFromBindPose(
    boneIndex: number,
    shapeModelTransform: Matrix4,
    target: Matrix4,
  ) {
    return target
      .copy(this.mmd.mesh.skeleton.boneInverses[boneIndex])
      .multiply(this.mmd.mesh.bindMatrix)
      .multiply(shapeModelTransform)
  }

  private getBodyWorldMatrixFromBone(
    resource: RigidBodyResource,
    target: Matrix4,
  ): Matrix4 {
    const boneModelMatrix = this.temporaryMatrixB
      .copy(this.inverseRootMatrix)
      .multiply(resource.bone!.matrixWorld)
    target.copy(boneModelMatrix).multiply(resource.bodyOffset)
    return this.temporaryMatrixC
      .copy(this.physicsRootMatrix)
      .multiply(target)
  }

  private makeKinematic(resource: RigidBodyResource) {
    resource.body.setCollisionFlags(
      resource.body.getCollisionFlags() | CF_KINEMATIC_OBJECT,
    )
    resource.body.setActivationState(DISABLE_DEACTIVATION)
  }

  private modelToBoneLocal(bone: Bone, modelTransform: Matrix4, target: Matrix4) {
    const parent = bone.parent
    if (parent && 'isBone' in parent && parent.isBone === true) {
      const parentModel = this.temporaryMatrixA
        .copy(this.inverseRootMatrix)
        .multiply(parent.matrixWorld)
      target.copy(parentModel).invert().multiply(modelTransform)
    }
    else {
      target.copy(modelTransform)
    }
  }

  private readBodyTransform(body: Ammo.btRigidBody, target: Matrix4) {
    const transform = body.getWorldTransform()
    const origin = transform.getOrigin()
    const rotation = transform.getRotation()
    return target.compose(
      this.temporaryPosition.set(origin.x(), origin.y(), origin.z()),
      this.temporaryQuaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w()),
      this.temporaryScale.set(1, 1, 1),
    )
  }

  private readRootTransform() {
    const mesh = this.mmd.mesh
    mesh.updateMatrixWorld(true)
    mesh.matrixWorld.decompose(
      this.temporaryPosition,
      this.rootQuaternion,
      this.temporaryScale,
    )
    this.inverseRootMatrix.copy(mesh.matrixWorld).invert()
    this.physicsRootMatrix.compose(
      this.temporaryPosition,
      this.rootQuaternion,
      this.temporaryScale.set(1, 1, 1),
    )
    this.inversePhysicsRootMatrix.copy(this.physicsRootMatrix).invert()
  }

  private restoreDynamic(resource: RigidBodyResource) {
    this.zeroBodyVelocity(resource)
    resource.body.setCollisionFlags(
      resource.body.getCollisionFlags() & ~CF_KINEMATIC_OBJECT,
    )
    resource.body.activate(true)
  }

  private setConstraintLimits(
    constraint: Ammo.btGeneric6DofSpringConstraint,
    joint: PmxObject.Joint,
  ) {
    this.temporaryAmmoVector.setValue(
      joint.positionMin[0],
      joint.positionMin[1],
      joint.positionMin[2],
    )
    constraint.setLinearLowerLimit(this.temporaryAmmoVector)
    this.temporaryAmmoVector.setValue(
      joint.positionMax[0],
      joint.positionMax[1],
      joint.positionMax[2],
    )
    constraint.setLinearUpperLimit(this.temporaryAmmoVector)
    this.temporaryAmmoVector.setValue(
      normalizeAngle(joint.rotationMin[0]),
      normalizeAngle(joint.rotationMin[1]),
      normalizeAngle(joint.rotationMin[2]),
    )
    constraint.setAngularLowerLimit(this.temporaryAmmoVector)
    this.temporaryAmmoVector.setValue(
      normalizeAngle(joint.rotationMax[0]),
      normalizeAngle(joint.rotationMax[1]),
      normalizeAngle(joint.rotationMax[2]),
    )
    constraint.setAngularUpperLimit(this.temporaryAmmoVector)
  }

  private setKinematicToggle(resource: RigidBodyResource, value: boolean) {
    if (resource.kinematicToggle === value)
      return

    resource.kinematicToggle = value
    if (resource.temporalKinematic)
      return

    if (value)
      this.makeKinematic(resource)
    else
      this.restoreDynamic(resource)
  }

  private setTemporalKinematic(resource: RigidBodyResource, value: boolean) {
    if (resource.temporalKinematic === value)
      return

    resource.temporalKinematic = value
    if (resource.kinematicToggle)
      return

    if (value)
      this.makeKinematic(resource)
    else
      this.restoreDynamic(resource)
  }

  private worldToModelTransform(worldTransform: Matrix4, target: Matrix4) {
    target.copy(this.inversePhysicsRootMatrix).multiply(worldTransform)
    target.decompose(
      this.temporaryPosition,
      this.temporaryQuaternion,
      this.temporaryScale,
    )
    return target.compose(
      this.temporaryPosition,
      this.temporaryQuaternion,
      this.temporaryScale.set(1, 1, 1),
    )
  }

  private writeBodyTransform(
    resource: RigidBodyResource,
    transform: Matrix4,
  ) {
    transform.decompose(
      this.temporaryPosition,
      this.temporaryQuaternion,
      this.temporaryScale,
    )
    this.temporaryAmmoVector.setValue(
      this.temporaryPosition.x,
      this.temporaryPosition.y,
      this.temporaryPosition.z,
    )
    this.temporaryAmmoQuaternion.setValue(
      this.temporaryQuaternion.x,
      this.temporaryQuaternion.y,
      this.temporaryQuaternion.z,
      this.temporaryQuaternion.w,
    )
    this.temporaryAmmoTransform.setOrigin(this.temporaryAmmoVector)
    this.temporaryAmmoTransform.setRotation(this.temporaryAmmoQuaternion)
    resource.body.setWorldTransform(this.temporaryAmmoTransform)
    resource.motionState.setWorldTransform(this.temporaryAmmoTransform)
    resource.body.activate(true)
    this.world.world.updateSingleAabb(resource.body)
  }

  private zeroBodyVelocity(resource: RigidBodyResource) {
    this.temporaryAmmoVector.setValue(0, 0, 0)
    resource.body.setLinearVelocity(this.temporaryAmmoVector)
    resource.body.setAngularVelocity(this.temporaryAmmoVector)
    resource.body.clearForces()
  }
}

export type { RigidBodyResource }
