/* eslint-disable new-cap */
import type { PmdRigidBodyInfo, PmxRigidBodyInfo } from '@noname0310/mmd-parser'
import type { SkinnedMesh } from 'three'

import Ammo from 'ammojs-typed'
import { Bone } from 'three'

import type { ResourceManager } from './resource-manager'

export class RigidBody {
  body: Ammo.btRigidBody
  bone: Bone
  boneOffsetForm: Ammo.btTransform
  boneOffsetFormInverse: Ammo.btTransform
  manager: ResourceManager

  mesh: SkinnedMesh
  params: PmdRigidBodyInfo | PmxRigidBodyInfo
  world: Ammo.btDiscreteDynamicsWorld

  constructor(
    mesh: SkinnedMesh,
    world: Ammo.btDiscreteDynamicsWorld,
    params: PmdRigidBodyInfo | PmxRigidBodyInfo,
    manager: ResourceManager,
  ) {
    this.mesh = mesh
    this.world = world
    this.params = params
    this.manager = manager

    const generateShape = (p: PmdRigidBodyInfo | PmxRigidBodyInfo) => {
      switch (p.shapeType) {
        case 0:
          return new Ammo.btSphereShape(p.width)
        case 1:
          return new Ammo.btBoxShape(new Ammo.btVector3(p.width, p.height, p.depth))
        case 2:
          return new Ammo.btCapsuleShape(p.width, p.height)
        default:
          throw new Error(`unknown shape type ${p.shapeType}`)
      }
    }

    const bones = this.mesh.skeleton.bones
    const bone = (this.params.boneIndex === -1)
      ? new Bone()
      : bones[this.params.boneIndex]

    const shape = generateShape(this.params)
    const weight = (this.params.type === 0) ? 0 : this.params.weight
    const localInertia = this.manager.allocVector3()
    localInertia.setValue(0, 0, 0)

    if (weight !== 0) {
      shape.calculateLocalInertia(weight, localInertia)
    }

    const boneOffsetForm = this.manager.allocTransform()
    this.manager.setIdentity(boneOffsetForm)
    this.manager.setOriginFromArray3(boneOffsetForm, this.params.position)
    this.manager.setBasisFromArray3(boneOffsetForm, this.params.rotation)

    const vector = this.manager.allocThreeVector3()
    const boneForm = this.manager.allocTransform()
    this.manager.setIdentity(boneForm)
    this.manager.setOriginFromThreeVector3(boneForm, bone.getWorldPosition(vector))

    const form = this.manager.multiplyTransforms(boneForm, boneOffsetForm)
    const state = new Ammo.btDefaultMotionState(form)

    const info = new Ammo.btRigidBodyConstructionInfo(weight, state, shape, localInertia)
    info.set_m_friction(this.params.friction)
    info.set_m_restitution(this.params.restitution)

    const body = new Ammo.btRigidBody(info)

    if (this.params.type === 0) {
      body.setCollisionFlags(body.getCollisionFlags() | 2)

      /*
       * It'd be better to comment out this line though in general I should call this method
       * because I'm not sure why but physics will be more like MMD's
       * if I comment out.
       */
      body.setActivationState(4)
    }

    body.setDamping(this.params.positionDamping, this.params.rotationDamping)
    body.setSleepingThresholds(0, 0)

    this.world.addRigidBody(body, 1 << this.params.groupIndex, this.params.groupTarget)

    this.body = body
    this.bone = bone
    this.boneOffsetForm = boneOffsetForm
    this.boneOffsetFormInverse = this.manager.inverseTransform(boneOffsetForm)

    this.manager.freeVector3(localInertia)
    this.manager.freeTransform(form)
    this.manager.freeTransform(boneForm)
    this.manager.freeThreeVector3(vector)
  }

  _getBoneTransform() {
    const manager = this.manager
    const p = manager.allocThreeVector3()
    const q = manager.allocThreeQuaternion()
    const s = manager.allocThreeVector3()

    this.bone.matrixWorld.decompose(p, q, s)

    const tr = manager.allocTransform()
    manager.setOriginFromThreeVector3(tr, p)
    manager.setBasisFromThreeQuaternion(tr, q)

    const form = manager.multiplyTransforms(tr, this.boneOffsetForm)

    manager.freeTransform(tr)
    manager.freeThreeVector3(s)
    manager.freeThreeQuaternion(q)
    manager.freeThreeVector3(p)

    return form
  }

  _getWorldTransformForBone() {
    const manager = this.manager
    const tr = this.body.getCenterOfMassTransform()
    return manager.multiplyTransforms(tr, this.boneOffsetFormInverse)
  }

  _setPositionFromBone() {
    const manager = this.manager
    const form = this._getBoneTransform()

    const tr = manager.allocTransform()
    this.body.getMotionState().getWorldTransform(tr)
    manager.copyOrigin(tr, form)

    // TODO: check the most appropriate way to set
    // this.body.setWorldTransform( tr );
    this.body.setCenterOfMassTransform(tr)
    this.body.getMotionState().setWorldTransform(tr)

    manager.freeTransform(tr)
    manager.freeTransform(form)
  }

  _setTransformFromBone() {
    const manager = this.manager
    const form = this._getBoneTransform()

    // TODO: check the most appropriate way to set
    // this.body.setWorldTransform( form );
    this.body.setCenterOfMassTransform(form)
    this.body.getMotionState().setWorldTransform(form)

    manager.freeTransform(form)
  }

  _updateBonePosition() {
    const manager = this.manager

    const tr = this._getWorldTransformForBone()

    const thV = manager.allocThreeVector3()

    const o = manager.getOrigin(tr)
    thV.set(o.x(), o.y(), o.z())

    if (this.bone.parent) {
      this.bone.parent.worldToLocal(thV)
    }

    this.bone.position.copy(thV)

    manager.freeThreeVector3(thV)

    manager.freeTransform(tr)
  }

  _updateBoneRotation() {
    const manager = this.manager

    const tr = this._getWorldTransformForBone()
    const q = manager.getBasis(tr)

    const thQ = manager.allocThreeQuaternion()
    const thQ2 = manager.allocThreeQuaternion()
    const thQ3 = manager.allocThreeQuaternion()

    thQ.set(q.x(), q.y(), q.z(), q.w())
    thQ2.setFromRotationMatrix(this.bone.matrixWorld)
    thQ2.conjugate()
    thQ2.multiply(thQ)

    // this.bone.quaternion.multiply( thQ2 );

    thQ3.setFromRotationMatrix(this.bone.matrix)

    // Renormalizing quaternion here because repeatedly transforming
    // quaternion continuously accumulates floating point error and
    // can end up being overflow. See #15335
    this.bone.quaternion.copy(thQ2.multiply(thQ3).normalize())

    manager.freeThreeQuaternion(thQ)
    manager.freeThreeQuaternion(thQ2)
    manager.freeThreeQuaternion(thQ3)

    manager.freeQuaternion(q)
    manager.freeTransform(tr)
  }

  /**
   * Resets rigid body transform to the current bone's.
   */
  reset() {
    this._setTransformFromBone()
    return this
  }

  /**
   * Updates bone from the current rigid body's transform.
   */
  updateBone() {
    if (this.params.type === 0 || this.params.boneIndex === -1) {
      return this
    }

    this._updateBoneRotation()

    if (this.params.type === 1) {
      this._updateBonePosition()
    }

    this.bone.updateMatrixWorld(true)

    if (this.params.type === 2) {
      this._setPositionFromBone()
    }

    return this
  }

  /**
   * Updates rigid body's transform from the current bone.
   */
  updateFromBone() {
    if (this.params.boneIndex !== -1 && this.params.type === 0) {
      this._setTransformFromBone()
    }

    return this
  }
}
