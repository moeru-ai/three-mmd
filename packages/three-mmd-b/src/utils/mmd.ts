// import type { VRMSpringBoneColliderShape } from '@pixiv/three-vrm-springbone'
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderHelper,
  VRMSpringBoneColliderShapeCapsule,
  // VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneJointHelper,
  VRMSpringBoneManager,
} from '@pixiv/three-vrm-springbone'
import { Vector3 } from 'three'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

export class MMD {
  public grants: Grant[]
  public iks: IK[]
  public mesh: SkinnedMesh

  public springBoneManager: VRMSpringBoneManager = new VRMSpringBoneManager()

  private springBoneColliders: VRMSpringBoneCollider[] = []
  private springBoneJoints: VRMSpringBoneJoint[] = []

  constructor(pmx: PmxObject, resourcePath: string) {
    this.grants = buildGrants(pmx)
    this.iks = buildIK(pmx)
    this.mesh = buildMesh(pmx, resourcePath)

    // console.log(this.mesh.skeleton.bones.map(bone => bone.name))

    this._initHairJoints()
    this._initColliders()
    this._initSkirtJoints()

    this.springBoneJoints.forEach(j => this.springBoneManager.addJoint(j))

    this.mesh.updateMatrixWorld(true)
    this.springBoneManager.setInitState()
  }

  public createColliderHelpers(): VRMSpringBoneColliderHelper[] {
    const helpers: VRMSpringBoneColliderHelper[] = []

    this.springBoneColliders.forEach(c => helpers.push(new VRMSpringBoneColliderHelper(c)))

    return helpers
  }

  public createJointHelpers(): VRMSpringBoneJointHelper[] {
    const helpers: VRMSpringBoneJointHelper[] = []

    this.springBoneJoints.forEach(j => helpers.push(new VRMSpringBoneJointHelper(j)))

    return helpers
  }

  public update(delta: number) {
    this.springBoneManager.update(delta)
  }

  private _initColliders() {
    const leftLeg = this.mesh.skeleton.bones.find(b => b.name === '左足' || b.name === 'Left Leg')
    const rightLeg = this.mesh.skeleton.bones.find(b => b.name === '右足' || b.name === 'Right Leg')

    if (leftLeg) {
      const leftLegCollider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
        // offset: leftLeg.getWorldPosition(new Vector3()),
        radius: 0.1,
        tail: new Vector3(1.0, 1.0, 1.0),
      }))

      leftLeg.add(leftLegCollider)
      this.springBoneColliders.push(leftLegCollider)
    }

    if (rightLeg) {
      const rightLegCollider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
        // offset: rightLeg.getWorldPosition(new Vector3()),
        radius: 0.1,
        tail: new Vector3(1.0, 1.0, 1.0),
      }))

      rightLeg.add(rightLegCollider)
      this.springBoneColliders.push(rightLegCollider)
    }

    // pmx.rigidBodies
    //   .filter(rigidBody => ['右足', '左足'].includes(rigidBody.name))
    //   .forEach((rigidBody) => {
    //     let shape: undefined | VRMSpringBoneColliderShape
    //     const shapeSize = new Vector3().fromArray(rigidBody.shapeSize).setZ(1)
    //     if (rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Sphere) {
    //       shape = new VRMSpringBoneColliderShapeSphere({
    //         offset: shapeSize,
    //       })
    //     }
    //     else if (rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Capsule) {
    //       shape = new VRMSpringBoneColliderShapeCapsule({
    //         offset: new Vector3().fromArray(rigidBody.shapePosition),
    //         radius: rigidBody.shapeSize[0], // x
    //       })
    //     }

    //     if (shape != null) {
    //       const collider = new VRMSpringBoneCollider(shape)

    //       // if (rigidBody.shapePosition.every(n => !Number.isNaN(n)))
    //       //   collider.position.set(...rigidBody.shapePosition)

    //       // if (rigidBody.shapeRotation.every(n => !Number.isNaN(n)))
    //       //   collider.rotation.set(...rigidBody.shapeRotation)

    //       this.springBoneColliders.push(collider)
    //     }
    //   })
  }

  private _initHairJoints() {
    this.mesh.skeleton.bones
      .filter(bone => [
        '髪',
        'Hair',
        'Twin',
      ].some(v => bone.name.includes(v)))
      .forEach(bone => bone.children.forEach(childBone =>
        this.springBoneJoints.push(new VRMSpringBoneJoint(bone, childBone, {
          dragForce: 0.4,
          gravityPower: 0.1,
          hitRadius: 0.02,
          stiffness: 1.0,
        })),
      ))
  }

  private _initSkirtJoints() {
    this.mesh.skeleton.bones
      .filter(bone => [
        '裙',
        'スカート',
        'Skirt',
      ].some(v => bone.name.includes(v)))
      .forEach(bone => bone.children.forEach((childBone) => {
        const joint = new VRMSpringBoneJoint(bone, childBone)
        joint.colliderGroups = [{ colliders: this.springBoneColliders }]
        this.springBoneJoints.push(joint)
      }))
  }
}
