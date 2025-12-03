import type { SkinnedMesh } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
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

import type { MMDPhysics } from './mmd-physics'

export class MMDPhysicsHelper extends Object3D {
  materials: [MeshBasicMaterial, MeshBasicMaterial, MeshBasicMaterial]
  physics: MMDPhysics
  root: SkinnedMesh

  private _matrixWorldInv = new Matrix4()
  private _position = new Vector3()
  private _quaternion = new Quaternion()
  private _scale = new Vector3()

  /**
   * Visualize Rigid bodies
   */
  constructor(mesh: SkinnedMesh, physics: MMDPhysics) {
    super()

    this.root = mesh
    this.physics = physics

    this.matrix.copy(mesh.matrixWorld)
    this.matrixAutoUpdate = false

    this.materials = [
      new MeshBasicMaterial({
        color: new Color(0xFF8888),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
      new MeshBasicMaterial({
        color: new Color(0x88FF88),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
      new MeshBasicMaterial({
        color: new Color(0x8888FF),
        depthTest: false,
        depthWrite: false,
        opacity: 0.25,
        transparent: true,
        wireframe: true,
      }),
    ]

    this._init()
  }

  _init() {
    const bodies = this.physics.bodies

    const createGeometry = (param: PmxObject.RigidBody) => {
      const [width, height, depth] = param.shapeSize
      switch (param.shapeType) {
        case PmxObject.RigidBody.ShapeType.Box:
          return new BoxGeometry(width, height, depth, 8, 8, 8)
        case PmxObject.RigidBody.ShapeType.Capsule:
          return new CapsuleGeometry(width, height, 8, 16)
        case PmxObject.RigidBody.ShapeType.Sphere:
          return new SphereGeometry(width, 16, 8)
        default:
          return undefined
      }
    }

    for (let i = 0, il = bodies.length; i < il; i++) {
      const param = bodies[i].params
      this.add(new Mesh(createGeometry(param), this.materials[param.physicsMode]))
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

      if ('isMesh' in child && child.isMesh === true)
        (child as Mesh).geometry.dispose()
    }
  }

  // private method

  /**
   * Updates Rigid Bodies visualization.
   */
  updateMatrixWorld(force?: boolean) {
    const mesh = this.root

    if (this.visible) {
      const bodies = this.physics.bodies

      this._matrixWorldInv
        .copy(mesh.matrixWorld)
        .decompose(this._position, this._quaternion, this._scale)
        .compose(this._position, this._quaternion, this._scale.set(1, 1, 1))
        .invert()

      for (let i = 0, il = bodies.length; i < il; i++) {
        const body = bodies[i].body
        const child = this.children[i]

        const tr = body.getCenterOfMassTransform()
        const origin = tr.getOrigin()
        const rotation = tr.getRotation()

        child.position
          .set(origin.x(), origin.y(), origin.z())
          .applyMatrix4(this._matrixWorldInv)

        child.quaternion
          .setFromRotationMatrix(this._matrixWorldInv)
          .multiply(
            this._quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w()),
          )
      }
    }

    this.matrix
      .copy(mesh.matrixWorld)
      .decompose(this._position, this._quaternion, this._scale)
      .compose(this._position, this._quaternion, this._scale.set(1, 1, 1))

    super.updateMatrixWorld(force)
  }
}
