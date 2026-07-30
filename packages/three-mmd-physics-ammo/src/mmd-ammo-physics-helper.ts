import type { PmxObject } from '@moeru/three-mmd'

import type {
  MmdAmmoPhysicsModel,
  RigidBodyResource,
} from './mmd-ammo-physics-model'

import { PmxObject as Pmx } from '@moeru/three-mmd'
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
} from 'three'

export class MmdAmmoPhysicsHelper extends Object3D {
  private readonly getModel: () => MmdAmmoPhysicsModel
  private readonly materials = [
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
  ] as const

  public constructor(
    rigidBodies: readonly PmxObject.RigidBody[],
    getModel: () => MmdAmmoPhysicsModel,
  ) {
    super()
    this.getModel = getModel

    for (const rigidBody of rigidBodies) {
      const geometry = this.createGeometry(rigidBody)
      this.add(geometry
        ? new Mesh(geometry, this.materials[rigidBody.physicsMode])
        : new Object3D())
    }
  }

  public dispose() {
    for (const material of this.materials)
      material.dispose()
    for (const child of this.children) {
      if ('isMesh' in child && child.isMesh === true)
        (child as Mesh).geometry.dispose()
    }
  }

  public override updateMatrixWorld(force?: boolean) {
    if (this.visible) {
      const model = this.getModel()
      for (let i = 0; i < this.children.length; i++) {
        const resource = model.bodies[i]
        if (!resource)
          continue
        this.updateChild(this.children[i], resource, model.scalingFactor)
      }
    }

    super.updateMatrixWorld(force)
  }

  private createGeometry(rigidBody: PmxObject.RigidBody) {
    const [x, y, z] = rigidBody.shapeSize
    switch (rigidBody.shapeType) {
      case Pmx.RigidBody.ShapeType.Box:
        return new BoxGeometry(x * 2, y * 2, z * 2)
      case Pmx.RigidBody.ShapeType.Capsule:
        return new CapsuleGeometry(x, y, 8, 16)
      case Pmx.RigidBody.ShapeType.Sphere:
        return new SphereGeometry(x, 16, 8)
      default:
        return null
    }
  }

  private updateChild(
    child: Object3D,
    resource: RigidBodyResource,
    scale: number,
  ) {
    const transform = resource.body.getWorldTransform()
    const origin = transform.getOrigin()
    const rotation = transform.getRotation()
    child.position.set(origin.x(), origin.y(), origin.z())
    child.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w())
    child.scale.setScalar(scale)
  }
}
