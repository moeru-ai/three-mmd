/* eslint-disable new-cap */
import Ammo from 'ammojs-typed'
import {
  Bone,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'

import { ResourceManager } from './mmd-physics/resource-manager'

/**
 * Dependencies
 *  - Ammo.js https://github.com/kripken/ammo.js
 *
 * MMDPhysics calculates physics with Ammo(Bullet based JavaScript Physics engine)
 * for MMD model loaded by MMDLoader.
 *
 * TODO
 *  - Physics in Worker
 */

class Constraint {
  /**
   * @param {import('three').SkinnedMesh} mesh
   * @param {Ammo.btDiscreteDynamicsWorld} world
   * @param {RigidBody} bodyA
   * @param {RigidBody} bodyB
   * @param {object} params
   * @param {ResourceManager} manager
   */
  constructor(mesh, world, bodyA, bodyB, params, manager) {
    this.mesh = mesh
    this.world = world
    this.bodyA = bodyA
    this.bodyB = bodyB
    this.params = params
    this.manager = manager

    this.constraint = null

    this._init()
  }

  // private method

  _init() {
    const manager = this.manager
    const params = this.params
    const bodyA = this.bodyA
    const bodyB = this.bodyB

    const form = manager.allocTransform()
    manager.setIdentity(form)
    manager.setOriginFromArray3(form, params.position)
    manager.setBasisFromArray3(form, params.rotation)

    const formA = manager.allocTransform()
    const formB = manager.allocTransform()

    bodyA.body.getMotionState().getWorldTransform(formA)
    bodyB.body.getMotionState().getWorldTransform(formB)

    const formInverseA = manager.inverseTransform(formA)
    const formInverseB = manager.inverseTransform(formB)

    const formA2 = manager.multiplyTransforms(formInverseA, form)
    const formB2 = manager.multiplyTransforms(formInverseB, form)

    const constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA.body, bodyB.body, formA2, formB2, true)

    const lll = manager.allocVector3()
    const lul = manager.allocVector3()
    const all = manager.allocVector3()
    const aul = manager.allocVector3()

    lll.setValue(params.translationLimitation1[0], params.translationLimitation1[1], params.translationLimitation1[2])
    lul.setValue(params.translationLimitation2[0], params.translationLimitation2[1], params.translationLimitation2[2])
    all.setValue(params.rotationLimitation1[0], params.rotationLimitation1[1], params.rotationLimitation1[2])
    aul.setValue(params.rotationLimitation2[0], params.rotationLimitation2[1], params.rotationLimitation2[2])

    constraint.setLinearLowerLimit(lll)
    constraint.setLinearUpperLimit(lul)
    constraint.setAngularLowerLimit(all)
    constraint.setAngularUpperLimit(aul)

    for (let i = 0; i < 3; i++) {
      if (params.springPosition[i] !== 0) {
        constraint.enableSpring(i, true)
        constraint.setStiffness(i, params.springPosition[i])
      }
    }

    for (let i = 0; i < 3; i++) {
      if (params.springRotation[i] !== 0) {
        constraint.enableSpring(i + 3, true)
        constraint.setStiffness(i + 3, params.springRotation[i])
      }
    }

    /*
     * Currently(10/31/2016) official ammo.js doesn't support
     * btGeneric6DofSpringConstraint.setParam method.
     * You need custom ammo.js (add the method into idl) if you wanna use.
     * By setting this parameter, physics will be more like MMD's
     */
    if (constraint.setParam !== undefined) {
      for (let i = 0; i < 6; i++) {
        constraint.setParam(2, 0.475, i)
      }
    }

    this.world.addConstraint(constraint, true)
    this.constraint = constraint

    manager.freeTransform(form)
    manager.freeTransform(formA)
    manager.freeTransform(formB)
    manager.freeTransform(formInverseA)
    manager.freeTransform(formInverseB)
    manager.freeTransform(formA2)
    manager.freeTransform(formB2)
    manager.freeVector3(lll)
    manager.freeVector3(lul)
    manager.freeVector3(all)
    manager.freeVector3(aul)
  }
}

class MMDPhysics {
  /**
   * @param {import('three').SkinnedMesh} mesh
   * @param {Array<object>} rigidBodyParams
   * @param {Array<object>} constraintParams - (optional)
   * @param {object} params - (optional)
   * @param {number} params.unitStep - Default is 1 / 65.
   * @param {number} params.maxStepNum - Default is 3.
   * @param {Vector3} params.gravity - Default is ( 0, - 9.8 * 10, 0 )
   */
  constructor(mesh, rigidBodyParams, constraintParams = [], params = {}) {
    if (typeof Ammo === 'undefined') {
      throw new TypeError('MMDPhysics: Import ammo.js https://github.com/kripken/ammo.js')
    }

    this.manager = new ResourceManager()

    this.mesh = mesh

    /*
     * I don't know why but 1/60 unitStep easily breaks models
     * so I set it 1/65 so far.
     * Don't set too small unitStep because
     * the smaller unitStep can make the performance worse.
     */
    this.unitStep = (params.unitStep !== undefined) ? params.unitStep : 1 / 65
    this.maxStepNum = (params.maxStepNum !== undefined) ? params.maxStepNum : 3
    this.gravity = new Vector3(0, -9.8 * 10, 0)

    if (params.gravity !== undefined)
      this.gravity.copy(params.gravity)

    this.world = params.world !== undefined ? params.world : null // experimental

    this.bodies = []
    this.constraints = []

    this._init(mesh, rigidBodyParams, constraintParams)
  }

  _createWorld() {
    const config = new Ammo.btDefaultCollisionConfiguration()
    const dispatcher = new Ammo.btCollisionDispatcher(config)
    const cache = new Ammo.btDbvtBroadphase()
    const solver = new Ammo.btSequentialImpulseConstraintSolver()
    const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, cache, solver, config)
    return world
  }

  _init(mesh, rigidBodyParams, constraintParams) {
    const manager = this.manager

    // rigid body/constraint parameters are for
    // mesh's default world transform as position(0, 0, 0),
    // quaternion(0, 0, 0, 1) and scale(0, 0, 0)

    const parent = mesh.parent

    if (parent !== null)
      mesh.parent = null

    const currentPosition = manager.allocThreeVector3()
    const currentQuaternion = manager.allocThreeQuaternion()
    const currentScale = manager.allocThreeVector3()

    currentPosition.copy(mesh.position)
    currentQuaternion.copy(mesh.quaternion)
    currentScale.copy(mesh.scale)

    mesh.position.set(0, 0, 0)
    mesh.quaternion.set(0, 0, 0, 1)
    mesh.scale.set(1, 1, 1)

    mesh.updateMatrixWorld(true)

    if (this.world === null) {
      this.world = this._createWorld()
      this.setGravity(this.gravity)
    }

    this._initRigidBodies(rigidBodyParams)
    this._initConstraints(constraintParams)

    if (parent !== null)
      mesh.parent = parent

    mesh.position.copy(currentPosition)
    mesh.quaternion.copy(currentQuaternion)
    mesh.scale.copy(currentScale)

    mesh.updateMatrixWorld(true)

    this.reset()

    manager.freeThreeVector3(currentPosition)
    manager.freeThreeQuaternion(currentQuaternion)
    manager.freeThreeVector3(currentScale)
  }

  _initConstraints(constraints) {
    for (let i = 0, il = constraints.length; i < il; i++) {
      const params = constraints[i]
      const bodyA = this.bodies[params.rigidBodyIndex1]
      const bodyB = this.bodies[params.rigidBodyIndex2]
      this.constraints.push(new Constraint(this.mesh, this.world, bodyA, bodyB, params, this.manager))
    }
  }

  _initRigidBodies(rigidBodies) {
    for (let i = 0, il = rigidBodies.length; i < il; i++) {
      this.bodies.push(new RigidBody(
        this.mesh,
        this.world,
        rigidBodies[i],
        this.manager,
      ))
    }
  }

  _stepSimulation(delta) {
    const unitStep = this.unitStep
    let stepTime = delta
    let maxStepNum = ((delta / unitStep) | 0) + 1

    if (stepTime < unitStep) {
      stepTime = unitStep
      maxStepNum = 1
    }

    if (maxStepNum > this.maxStepNum) {
      maxStepNum = this.maxStepNum
    }

    this.world.stepSimulation(stepTime, maxStepNum, unitStep)
  }

  // private methods

  _updateBones() {
    for (let i = 0, il = this.bodies.length; i < il; i++) {
      this.bodies[i].updateBone()
    }
  }

  _updateRigidBodies() {
    for (let i = 0, il = this.bodies.length; i < il; i++) {
      this.bodies[i].updateFromBone()
    }
  }

  /**
   * Creates MMDPhysicsHelper
   *
   * @return {MMDPhysicsHelper}
   */
  createHelper() {
    return new MMDPhysicsHelper(this.mesh, this)
  }

  /**
   * Resets rigid bodies transform to current bone's.
   *
   * @return {MMDPhysics}
   */
  reset() {
    for (let i = 0, il = this.bodies.length; i < il; i++) {
      this.bodies[i].reset()
    }

    return this
  }

  /**
   * Sets gravity.
   *
   * @param {Vector3} gravity
   * @return {MMDPhysicsHelper}
   */
  setGravity(gravity) {
    this.world.setGravity(new Ammo.btVector3(gravity.x, gravity.y, gravity.z))
    this.gravity.copy(gravity)

    return this
  }

  /**
   * Advances Physics calculation and updates bones.
   *
   * @param {number} delta - time in second
   * @return {MMDPhysics}
   */
  update(delta) {
    const manager = this.manager
    const mesh = this.mesh

    // rigid bodies and constrains are for
    // mesh's world scale (1, 1, 1).
    // Convert to (1, 1, 1) if it isn't.

    let isNonDefaultScale = false

    const position = manager.allocThreeVector3()
    const quaternion = manager.allocThreeQuaternion()
    const scale = manager.allocThreeVector3()

    mesh.matrixWorld.decompose(position, quaternion, scale)

    if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
      isNonDefaultScale = true
    }

    let parent

    if (isNonDefaultScale) {
      parent = mesh.parent

      if (parent !== null)
        mesh.parent = null

      scale.copy(this.mesh.scale)

      mesh.scale.set(1, 1, 1)
      mesh.updateMatrixWorld(true)
    }

    // calculate physics and update bones

    this._updateRigidBodies()
    this._stepSimulation(delta)
    this._updateBones()

    // restore mesh if converted above

    if (isNonDefaultScale) {
      if (parent !== null)
        mesh.parent = parent

      mesh.scale.copy(scale)
    }

    manager.freeThreeVector3(scale)
    manager.freeThreeQuaternion(quaternion)
    manager.freeThreeVector3(position)

    return this
  }

  /**
   * Warm ups Rigid bodies. Calculates cycles steps.
   *
   * @param {number} cycles
   * @return {MMDPhysics}
   */
  warmup(cycles) {
    for (let i = 0; i < cycles; i++) {
      this.update(1 / 60)
    }

    return this
  }
}

/**
 * @param {import('three').SkinnedMesh} mesh
 * @param {Ammo.btDiscreteDynamicsWorld} world
 * @param {object} params
 * @param {ResourceManager} manager
 */
class RigidBody {
  constructor(mesh, world, params, manager) {
    this.mesh = mesh
    this.world = world
    this.params = params
    this.manager = manager

    this.body = null
    this.bone = null
    this.boneOffsetForm = null
    this.boneOffsetFormInverse = null

    this._init()
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

  _init() {
    const generateShape = (p) => {
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

    const manager = this.manager
    const params = this.params
    const bones = this.mesh.skeleton.bones
    const bone = (params.boneIndex === -1)
      ? new Bone()
      : bones[params.boneIndex]

    const shape = generateShape(params)
    const weight = (params.type === 0) ? 0 : params.weight
    const localInertia = manager.allocVector3()
    localInertia.setValue(0, 0, 0)

    if (weight !== 0) {
      shape.calculateLocalInertia(weight, localInertia)
    }

    const boneOffsetForm = manager.allocTransform()
    manager.setIdentity(boneOffsetForm)
    manager.setOriginFromArray3(boneOffsetForm, params.position)
    manager.setBasisFromArray3(boneOffsetForm, params.rotation)

    const vector = manager.allocThreeVector3()
    const boneForm = manager.allocTransform()
    manager.setIdentity(boneForm)
    manager.setOriginFromThreeVector3(boneForm, bone.getWorldPosition(vector))

    const form = manager.multiplyTransforms(boneForm, boneOffsetForm)
    const state = new Ammo.btDefaultMotionState(form)

    const info = new Ammo.btRigidBodyConstructionInfo(weight, state, shape, localInertia)
    info.set_m_friction(params.friction)
    info.set_m_restitution(params.restitution)

    const body = new Ammo.btRigidBody(info)

    if (params.type === 0) {
      body.setCollisionFlags(body.getCollisionFlags() | 2)

      /*
       * It'd be better to comment out this line though in general I should call this method
       * because I'm not sure why but physics will be more like MMD's
       * if I comment out.
       */
      body.setActivationState(4)
    }

    body.setDamping(params.positionDamping, params.rotationDamping)
    body.setSleepingThresholds(0, 0)

    this.world.addRigidBody(body, 1 << params.groupIndex, params.groupTarget)

    this.body = body
    this.bone = bone
    this.boneOffsetForm = boneOffsetForm
    this.boneOffsetFormInverse = manager.inverseTransform(boneOffsetForm)

    manager.freeVector3(localInertia)
    manager.freeTransform(form)
    manager.freeTransform(boneForm)
    manager.freeThreeVector3(vector)
  }

  // private methods

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
   *
   * @return {RigidBody}
   */
  reset() {
    this._setTransformFromBone()
    return this
  }

  /**
   * Updates bone from the current ridid body's transform.
   *
   * @return {RidigBody}
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
   *
   * @return {RidigBody}
   */
  updateFromBone() {
    if (this.params.boneIndex !== -1 && this.params.type === 0) {
      this._setTransformFromBone()
    }

    return this
  }
}

//

const _position = new Vector3()
const _quaternion = new Quaternion()
const _scale = new Vector3()
const _matrixWorldInv = new Matrix4()

class MMDPhysicsHelper extends Object3D {
  /**
   * Visualize Rigid bodies
   *
   * @param {import('three').SkinnedMesh} mesh
   * @param {MMDPhysics} physics
   */
  constructor(mesh, physics) {
    super()

    this.root = mesh
    this.physics = physics

    this.matrix.copy(mesh.matrixWorld)
    this.matrixAutoUpdate = false

    this.materials = []

    this.materials.push(
      new MeshBasicMaterial({
        color: new Color(0xFF8888),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
    )

    this.materials.push(
      new MeshBasicMaterial({
        color: new Color(0x88FF88),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
    )

    this.materials.push(
      new MeshBasicMaterial({
        color: new Color(0x8888FF),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
    )

    this._init()
  }

  _init() {
    const bodies = this.physics.bodies

    const createGeometry = (param) => {
      switch (param.shapeType) {
        case 0:
          return new SphereGeometry(param.width, 16, 8)
        case 1:
          return new BoxGeometry(param.width * 2, param.height * 2, param.depth * 2, 8, 8, 8)
        case 2:
          return new CapsuleGeometry(param.width, param.height, 8, 16)
        default:
          return null
      }
    }

    for (let i = 0, il = bodies.length; i < il; i++) {
      const param = bodies[i].params
      this.add(new Mesh(createGeometry(param), this.materials[param.type]))
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this method whenever this instance is no longer used in your app.
   */
  dispose() {
    const materials = this.materials
    const children = this.children

    for (let i = 0; i < materials.length; i++) {
      materials[i].dispose()
    }

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (child.isMesh)
        child.geometry.dispose()
    }
  }

  // private method

  /**
   * Updates Rigid Bodies visualization.
   */
  updateMatrixWorld(force) {
    const mesh = this.root

    if (this.visible) {
      const bodies = this.physics.bodies

      _matrixWorldInv
        .copy(mesh.matrixWorld)
        .decompose(_position, _quaternion, _scale)
        .compose(_position, _quaternion, _scale.set(1, 1, 1))
        .invert()

      for (let i = 0, il = bodies.length; i < il; i++) {
        const body = bodies[i].body
        const child = this.children[i]

        const tr = body.getCenterOfMassTransform()
        const origin = tr.getOrigin()
        const rotation = tr.getRotation()

        child.position
          .set(origin.x(), origin.y(), origin.z())
          .applyMatrix4(_matrixWorldInv)

        child.quaternion
          .setFromRotationMatrix(_matrixWorldInv)
          .multiply(
            _quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w()),
          )
      }
    }

    this.matrix
      .copy(mesh.matrixWorld)
      .decompose(_position, _quaternion, _scale)
      .compose(_position, _quaternion, _scale.set(1, 1, 1))

    super.updateMatrixWorld(force)
  }
}

export { MMDPhysics }
