// import type { VRMSpringBoneColliderShape } from '@pixiv/three-vrm-springbone'
import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { Bone, SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderHelper,
  VRMSpringBoneColliderShape,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
  // VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneJointHelper,
  VRMSpringBoneManager,
} from '@pixiv/three-vrm-springbone'
import { Quaternion, Vector3 } from 'three'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

export class MMD {
  public grants: Grant[]
  public iks: IK[]
  public mesh: SkinnedMesh
  public pmx: PmxObject

  public springBoneManager: VRMSpringBoneManager = new VRMSpringBoneManager()

  private springBoneColliders: VRMSpringBoneCollider[] = []
  private springBoneJoints: VRMSpringBoneJoint[] = []

  constructor(pmx: PmxObject, resourcePath: string) {
    this.grants = buildGrants(pmx)
    this.iks = buildIK(pmx)
    this.mesh = buildMesh(pmx, resourcePath)
    this.pmx = pmx

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
    // TODO: need to consider the scale of the model, currently assuming scale is 1
    const bones = this.mesh.skeleton.bones
    this.mesh.updateMatrixWorld(true)

    // Find leg bones
    const legBones = bones
      .map((bone, idx) => ({ bone, idx }))
      .filter(({ bone }) => ['左足', '右足', '左足D', '右足D', '左ひざ', '右ひざ', '左足首', '右足首'].includes(bone.name))
    console.debug(legBones)
    // Map leg bones to their rigid bodies
    const legRigidBodiesMap = new Map<number, PmxObject.RigidBody[]>()
    this.pmx.rigidBodies.forEach((rigidBody) => {
      const boneIndexList = legRigidBodiesMap.get(rigidBody.boneIndex) ?? []
      boneIndexList.push(rigidBody)
      legRigidBodiesMap.set(rigidBody.boneIndex, boneIndexList)
    })
    console.debug(legRigidBodiesMap)

    const addColliderToBone = (bone: Bone, collider: VRMSpringBoneCollider) => {
      bone.add(collider)
      this.springBoneColliders.push(collider)
    }
    // Add colliders to leg bones
    legBones.forEach(({ bone, idx }) => {
      const child = bone.children[0]
      if (!child) return

      // Compute bone length and direction
      const childWorldPos = child.getWorldPosition(new Vector3())
      const boneWorldPos = bone.getWorldPosition(new Vector3())
      const segLocal = child.position.clone();
      const dirSeg = segLocal.clone().normalize()
      const boneLen = childWorldPos.distanceTo(boneWorldPos)
      console.debug(`Bone: ${bone.name}, Length: ${boneLen}`) 

      const rigidBodies = legRigidBodiesMap.get(idx)
      console.debug(`Setting up colliders for bone: ${bone.name}`)
      console.debug('corresponding rigid bodies: ', rigidBodies);
      if (rigidBodies && rigidBodies.length > 0) {
        rigidBodies.forEach((rigidBody) => {
          // find the local offset
          const offsetWorld = new Vector3().fromArray([
            rigidBody.shapePosition[0],
            rigidBody.shapePosition[1],
            -rigidBody.shapePosition[2] // Invert Z axis
          ]).applyMatrix4(this.mesh.matrixWorld)
          const offsetLocal = bone.worldToLocal(offsetWorld.clone())
          // Create collider shape sphere
          if(rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Sphere) {
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({
              offset: offsetLocal,
              // Sphere shapeSize [radius, ignore, ignore]
              radius: Math.min(rigidBody.shapeSize[0], boneLen * 0.5),
            }))
            addColliderToBone(bone, collider)
          } else if(rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Capsule) {
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Capsule shapeSize [radius, height, ignore]
              radius: Math.min(rigidBody.shapeSize[0], boneLen * 0.5),
              tail: dirSeg.normalize().multiplyScalar(
                Math.min(rigidBody.shapeSize[1], boneLen)
              ),
            }))
            addColliderToBone(bone, collider)
          } else {
            // Maybe box shape
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Box shapSize [width, height, depth]
              radius: Math.min(Math.max(rigidBody.shapeSize[0], rigidBody.shapeSize[2]), boneLen * 0.5),
              tail: dirSeg.normalize().multiplyScalar(
                Math.min(rigidBody.shapeSize[1], boneLen)
              ),
            }))
            addColliderToBone(bone, collider)
          }
        })
      } else {
        // No rigid body for this leg bone, add a default collider
        const radius = Math.min(boneLen * 0.1 * 1.2, boneLen * 0.5)
        const tail = dirSeg.clone().multiplyScalar(boneLen)
        addColliderToBone(bone, new VRMSpringBoneCollider(
          new VRMSpringBoneColliderShapeCapsule({ radius, tail }),
        ))
      }
    })
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
