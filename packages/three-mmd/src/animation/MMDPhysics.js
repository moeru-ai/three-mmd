/* eslint-disable new-cap */
import Ammo from 'ammojs-typed'
import {
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

import { Constraint } from './mmd-physics/constraint'
import { ResourceManager } from './mmd-physics/resource-manager'
import { RigidBody } from './mmd-physics/rigid-body'

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
