import type { Bone, SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderHelper,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneJointHelper,
  VRMSpringBoneManager,
} from '@pixiv/three-vrm-springbone'
import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Vector3 } from 'three'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

export class SpringBoneMMD {
  public grants: Grant[]
  public iks: IK[]
  public mesh: SkinnedMesh
  public pmx: PmxObject
  public scale: number

  public springBoneManager: VRMSpringBoneManager = new VRMSpringBoneManager()

  private baseColliderShapes: Map<
    VRMSpringBoneCollider,
    {
      radius: number
      tail?: Vector3
    }
  > = new Map()

  // Cache original joint and collider sizes for scaling
  private jointSizeMap: Map<
    VRMSpringBoneJoint,
    {
      dragForce?: number
      gravityPower?: number
      hitRadius: number
      stiffness: number
    }
  > = new Map()

  private springBoneColliders: VRMSpringBoneCollider[] = []
  private springBoneJoints: VRMSpringBoneJoint[] = []

  constructor(pmx: PmxObject, resourcePath: string) {
    this.grants = buildGrants(pmx)
    this.iks = buildIK(pmx)
    this.mesh = buildMesh(pmx, resourcePath)
    this.pmx = pmx
    this.scale = 1

    // console.log(this.mesh.skeleton.bones.map(bone => bone.name))

    this._initHairJoints()
    this._initColliders()
    this._initSkirtJoints()

    this.springBoneJoints.forEach(j => this.springBoneManager.addJoint(j))

    this.mesh.updateMatrixWorld(true)
    this.springBoneManager.setInitState()

    this.cacheJointsAndColliders()
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

  // https://github.com/pixiv/three-vrm/blob/dev/guides/spring-bones-on-scaled-models.md
  public setScalar(scale: number) {
    if (this.scale === scale)
      return
    this.scale = scale
    this.mesh.scale.setScalar(scale)

    // Update joint sizes
    this.springBoneJoints.forEach((joint) => {
      const baseSize = this.jointSizeMap.get(joint)
      if (!baseSize)
        return
      joint.settings.hitRadius = baseSize.hitRadius * scale
      // joint.settings.stiffness = baseSize.stiffness / scale
      // if (baseSize.dragForce !== undefined)
      // joint.settings.dragForce = baseSize.dragForce / scale
      if (baseSize.gravityPower !== undefined)
        joint.settings.gravityPower = baseSize.gravityPower * scale
    })

    // Update collider sizes
    this.springBoneColliders.forEach((collider) => {
      const baseShape = this.baseColliderShapes.get(collider)
      if (!baseShape)
        return
      const shape = collider.shape
      if (shape instanceof VRMSpringBoneColliderShapeSphere) {
        shape.radius = baseShape.radius * scale
      }
      else if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
        shape.radius = baseShape.radius * scale
        shape.tail = baseShape.tail!.clone().multiplyScalar(scale)
      }
    })

    this.mesh.updateMatrixWorld(true)
    this.mesh.skeleton.pose()
    this.mesh.updateMatrixWorld(true)
    this.springBoneManager.setInitState()
  }

  public update(delta: number) {
    this.springBoneManager.update(delta)
    // const iterations = 32
    // const step = delta / iterations
    // for (let i = 0; i < iterations; i++) {
    //   this.springBoneManager.update(step)
    // }
  }

  private _initColliders() {
    // TODO: need to consider the scale of the model, currently assuming scale is 1
    const bones = this.mesh.skeleton.bones
    // console.debug('bones:', bones)
    this.mesh.updateMatrixWorld(true)

    // Find leg bones
    const legBones = bones
      .map((bone, idx) => ({ bone, idx }))
      .filter(({ bone }) => ['センター', '上半身', '右ひざ', '右足', '右足D', '左ひざ', '左足', '左足D'].includes(bone.name))
    // console.debug(legBones)
    // Map leg bones to their rigid bodies
    const legRigidBodiesMap = new Map<number, PmxObject.RigidBody[]>()
    this.pmx.rigidBodies.forEach((rigidBody) => {
      const boneIndexList = legRigidBodiesMap.get(rigidBody.boneIndex) ?? []
      boneIndexList.push(rigidBody)
      legRigidBodiesMap.set(rigidBody.boneIndex, boneIndexList)
    })
    // console.debug(legRigidBodiesMap)

    const addColliderToBone = (bone: Bone, collider: VRMSpringBoneCollider) => {
      bone.add(collider)
      this.springBoneColliders.push(collider)
    }
    // Add colliders to leg bones
    legBones.forEach(({ bone, idx }) => {
      const child = bone.children[0]
      if (child == null)
        return

      // Compute bone length and direction
      const childWorldPos = child.getWorldPosition(new Vector3())
      const boneWorldPos = bone.getWorldPosition(new Vector3())
      const segLocal = child.position.clone()
      const dirSeg = segLocal.clone().normalize()
      const boneLen = childWorldPos.distanceTo(boneWorldPos)
      // console.debug(`Bone: ${bone.name}, Length: ${boneLen}`)

      const rigidBodies = legRigidBodiesMap.get(idx)
      // console.debug(`Setting up colliders for bone: ${bone.name}`)
      // console.debug('corresponding rigid bodies: ', rigidBodies)
      if (rigidBodies && rigidBodies.length > 0) {
        rigidBodies.forEach((rigidBody) => {
          // find the local offset
          const offsetWorld = new Vector3().fromArray([
            rigidBody.shapePosition[0],
            rigidBody.shapePosition[1],
            -rigidBody.shapePosition[2], // Invert Z axis
          ]).applyMatrix4(this.mesh.matrixWorld)
          const offsetLocal = bone.worldToLocal(offsetWorld.clone())
          // Create collider shape sphere
          if (rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Sphere) {
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({
              offset: offsetLocal,
              // Sphere shapeSize [radius, ignore, ignore]
              radius: rigidBody.shapeSize[0] * 1.1,
            }))
            addColliderToBone(bone, collider)
          }
          else if (rigidBody.shapeType === PmxObject.RigidBody.ShapeType.Capsule) {
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Capsule shapeSize [radius, height, ignore]
              radius: rigidBody.shapeSize[0] * 1.1,
              tail: dirSeg.normalize().multiplyScalar(
                Math.min(rigidBody.shapeSize[1], boneLen),
              ),
            }))
            addColliderToBone(bone, collider)
          }
          else {
            // Maybe box shape
            const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Box shapeSize [width, height, depth]
              radius: Math.max(rigidBody.shapeSize[0], rigidBody.shapeSize[2]) * 1.1,
              tail: dirSeg.normalize().multiplyScalar(
                Math.min(rigidBody.shapeSize[1], boneLen),
              ),
            }))
            addColliderToBone(bone, collider)
          }
        })
      }
      else {
        // No rigid body for this leg bone, add a default collider
        const radius = Math.min(boneLen * 0.1 * 1.2, boneLen * 0.5)
        const tail = dirSeg.clone().multiplyScalar(boneLen)
        addColliderToBone(bone, new VRMSpringBoneCollider(
          new VRMSpringBoneColliderShapeCapsule({ radius, tail }),
        ))
      }
    })
  }

  // Initialize hair joints based on bone names
  private _initHairJoints() {
    this.mesh.skeleton.bones
      .filter(bone => [
        '髪',
        'Hair',
        'Twin',
      ].some(v => bone.name.includes(v)))
      .forEach(bone => bone.children.forEach(childBone =>
        this.springBoneJoints.push(new VRMSpringBoneJoint(bone, childBone, {
          hitRadius: 0.05,
          stiffness: 0.75,
        })),
      ))
  }

  // Initialize skirt joints based on bone names
  private _initSkirtJoints() {
    this.mesh.skeleton.bones
      .filter(bone => [
        '裙',
        'スカート',
        'Skirt',
      ].some(v => bone.name.includes(v)))
      .forEach(bone => bone.children.forEach((childBone) => {
        const joint = new VRMSpringBoneJoint(bone, childBone, {
          dragForce: 0.1,
          gravityPower: 1,
          hitRadius: 0.15,
          stiffness: 5,
        })
        joint.colliderGroups = [{ colliders: this.springBoneColliders }]
        this.springBoneJoints.push(joint)
      }))
  }

  private cacheJointsAndColliders() {
    // Cache original joint sizes
    this.springBoneJoints.forEach((joint) => {
      this.jointSizeMap.set(joint, {
        dragForce: joint.settings.dragForce,
        gravityPower: joint.settings.gravityPower,
        hitRadius: joint.settings.hitRadius,
        stiffness: joint.settings.stiffness,
      })
    })
    // Cache original collider sizes
    this.springBoneColliders.forEach((collider) => {
      const shape = collider.shape
      if (shape instanceof VRMSpringBoneColliderShapeSphere) {
        this.baseColliderShapes.set(collider, {
          radius: shape.radius,
        })
      }
      else if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
        this.baseColliderShapes.set(collider, {
          radius: shape.radius,
          tail: shape.tail.clone(),
        })
      }
    })
  }
}
