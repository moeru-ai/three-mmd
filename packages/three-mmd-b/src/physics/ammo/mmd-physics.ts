/* eslint-disable new-cap */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'

import Ammo from 'ammojs-typed'
import { Vector3 } from 'three'

import { Constraint } from './constraint'
import { MMDPhysicsHelper } from './mmd-physics-helper'
import { ResourceManager } from './resource-manager'
import { RigidBody } from './rigid-body'

export interface MMDPhysicsParameter {
  gravity?: Vector3
  maxStepNum?: number
  unitStep?: number
  world?: Ammo.btDiscreteDynamicsWorld
}

export class MMDPhysics {
  bodies: RigidBody[]
  constraints: Constraint[]
  gravity: Vector3
  manager: ResourceManager
  maxStepNum: number
  mesh: SkinnedMesh
  unitStep: number
  world?: Ammo.btDiscreteDynamicsWorld

  constructor(mesh: SkinnedMesh, rigidBodyParams: PmxObject.RigidBody[], constraintParams: PmxObject.Joint[] = [], params: MMDPhysicsParameter = {}) {
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

    if (params.world !== undefined)
      this.world = params.world // experimental

    this.bodies = []
    this.constraints = []

    this._init(mesh, rigidBodyParams, constraintParams)
  }

  _createWorld() {
    const config = new Ammo.btDefaultCollisionConfiguration()
    const dispatcher = new Ammo.btCollisionDispatcher(config)
    const cache = new Ammo.btDbvtBroadphase()
    const solver = new Ammo.btSequentialImpulseConstraintSolver()

    return new Ammo.btDiscreteDynamicsWorld(dispatcher, cache, solver, config)
  }

  _init(mesh: SkinnedMesh, rigidBodyParams: PmxObject.RigidBody[], constraintParams: PmxObject.Joint[]) {
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

    if (this.world == null) {
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

  _initConstraints(constraints: PmxObject.Joint[]) {
    for (let i = 0, il = constraints.length; i < il; i++) {
      const params = constraints[i]
      const bodyA = this.bodies[params.rigidbodyIndexA]
      const bodyB = this.bodies[params.rigidbodyIndexB]
      this.constraints.push(new Constraint(this.mesh, this.world!, bodyA, bodyB, params, this.manager))
    }
  }

  _initRigidBodies(rigidBodies: PmxObject.RigidBody[]) {
    for (let i = 0, il = rigidBodies.length; i < il; i++) {
      this.bodies.push(new RigidBody(
        this.mesh,
        this.world!,
        rigidBodies[i],
        this.manager,
      ))
    }
  }

  _stepSimulation(delta: number) {
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

    this.world!.stepSimulation(stepTime, maxStepNum, unitStep)
  }

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
   */
  createHelper() {
    return new MMDPhysicsHelper(this.mesh, this)
  }

  /**
   * Resets rigid bodies transform to current bone's.
   */
  reset(): MMDPhysics {
    for (let i = 0, il = this.bodies.length; i < il; i++) {
      this.bodies[i].reset()
    }

    return this
  }

  /**
   * Sets gravity.
   */
  setGravity(gravity: Vector3) {
    this.world!.setGravity(new Ammo.btVector3(gravity.x, gravity.y, gravity.z))
    this.gravity.copy(gravity)

    return this
  }

  /**
   * Advances Physics calculation and updates bones.
   */
  update(delta: number) {
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
      if (parent != null)
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
   */
  warmup(cycles: number) {
    for (let i = 0; i < cycles; i++) {
      this.update(1 / 60)
    }

    return this
  }
}
