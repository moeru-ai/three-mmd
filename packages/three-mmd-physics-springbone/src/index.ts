import type { PhysicsFactory } from '@moeru/three-mmd'
/**
 * Spring bone physics strategy (functional): builds colliders/joints once from PMX + mesh,
 * powered by @pixiv/three-vrm-springbone. Exposes a PhysicsStrategy for plugging into MMD.
 */
import type { Bone, Object3D } from 'three'

import { createPhysicsPlugin, PmxObject } from '@moeru/three-mmd'
import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderHelper,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneJointHelper,
  VRMSpringBoneManager,
} from '@pixiv/three-vrm-springbone'
import { Vector3 } from 'three'

import { name } from '../package.json'

export interface SpringBoneHelpers {
  colliderHelpers: VRMSpringBoneColliderHelper[]
  jointHelpers: VRMSpringBoneJointHelper[]
}

export const MMDSpringBonePhysics: PhysicsFactory = (mmd) => {
  let manager = new VRMSpringBoneManager()
  const colliders: VRMSpringBoneCollider[] = []
  const joints: VRMSpringBoneJoint[] = []
  const gravity = new Vector3(0, -98, 0)
  let modelScale = mmd.scale
  let accumulator = 0

  // MMD models commonly use extra "weight" bones as rigid-body anchors. They
  // are children of the visible spring chain, but must not be used as tails.
  const isAuxiliaryBone = (bone: Object3D) => /(?:錘|weight|_physics)$/i.test(bone.name)
  const getSpringChild = (bone: Bone) => bone.children.find(child => !isAuxiliaryBone(child))

  const baseColliderShapes = new Map<VRMSpringBoneCollider, { radius: number, tail?: Vector3 }>()
  const baseJointSizes = new Map<
    VRMSpringBoneJoint,
    {
      dragForce?: number
      gravityPower?: number
      hitRadius: number
      stiffness: number
    }
  >()

  // Cache joint and collider sizes for scaling
  const cacheJointsAndColliders = () => {
    joints.forEach(j => baseJointSizes.set(j, {
      dragForce: j.settings.dragForce,
      gravityPower: j.settings.gravityPower,
      hitRadius: j.settings.hitRadius,
      stiffness: j.settings.stiffness,
    }))

    colliders.forEach((c) => {
      const shape = c.shape
      if (shape instanceof VRMSpringBoneColliderShapeSphere) {
        baseColliderShapes.set(c, { radius: shape.radius })
      }
      else if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
        baseColliderShapes.set(c, { radius: shape.radius, tail: shape.tail.clone() })
      }
    })
  }

  // Initialize hair joints based on bone names
  const setupHairJoints = () => {
    mmd.mesh.skeleton.bones
      .filter(bone => ['髪', 'Hair', 'Twin'].some(v => bone.name.includes(v)))
      .forEach((bone) => {
        const child = getSpringChild(bone)
        if (!child)
          return

        joints.push(new VRMSpringBoneJoint(bone, child, {
          dragForce: 0.4,
          gravityPower: 0.05,
          hitRadius: 0.05,
          stiffness: 0.75,
        }))
      })
  }

  // Initialize skirt joints based on bone names
  const setupSkirtJoints = () => {
    mmd.mesh.skeleton.bones
      .filter(bone => ['裙', 'スカート', 'Skirt'].some(v => bone.name.includes(v)))
      .forEach((bone) => {
        const child = getSpringChild(bone)
        if (!child)
          return

        const joint = new VRMSpringBoneJoint(bone, child, {
          // Keep the radial rest pose of the skirt while damping the long
          // chains enough to avoid feeding frame-time spikes back into the
          // Verlet velocity.
          dragForce: 0.7,
          gravityPower: 0.02,
          hitRadius: 0.12,
          stiffness: 5,
        })
        joint.colliderGroups = [{ colliders }]
        joints.push(joint)
      })
  }

  const setupColliders = () => {
    const bones = mmd.mesh.skeleton.bones
    mmd.mesh.updateMatrixWorld(true)

    const legBones = bones
      .map((bone, idx) => ({ bone, idx }))
      .filter(({ bone }) => ['センター', '上半身', '上半身2', '下半身', '右ひざ', '右足', '右足D', '左ひざ', '左足', '左足D'].includes(bone.name))
    // Map leg bones to their rigid bodies
    const legRigidBodiesMap = new Map<number, PmxObject.RigidBody[]>()
    mmd.pmx.rigidBodies.forEach((rb) => {
      const list = legRigidBodiesMap.get(rb.boneIndex) ?? []
      list.push(rb)
      legRigidBodiesMap.set(rb.boneIndex, list)
    })

    const addCollider = (bone: Bone, collider: VRMSpringBoneCollider) => {
      bone.add(collider)
      colliders.push(collider)
    }

    legBones.forEach(({ bone, idx }) => {
      // eslint-disable-next-line ts/strict-boolean-expressions
      if (!bone.children || bone.children.length === 0)
        return

      // Compute bone length and direction
      const child = getSpringChild(bone)
      if (!child)
        return
      const childWorld = child.getWorldPosition(new Vector3())
      const boneWorld = bone.getWorldPosition(new Vector3())
      const dirSeg = child.position.clone().normalize()
      const boneLen = childWorld.distanceTo(boneWorld)

      const rbs = legRigidBodiesMap.get(idx)
      if (rbs && rbs.length > 0) {
        rbs.forEach((rb) => {
          // Find the local offset
          const offsetWorld = new Vector3().fromArray([
            rb.shapePosition[0],
            rb.shapePosition[1],
            rb.shapePosition[2],
          ]).applyMatrix4(mmd.mesh.matrixWorld)
          const offsetLocal = bone.worldToLocal(offsetWorld.clone())
          // Create collider shape sphere
          if (rb.shapeType === PmxObject.RigidBody.ShapeType.Sphere) {
            addCollider(bone, new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({
              offset: offsetLocal,
              // Sphere shapeSize [radius, ignore, ignore]
              radius: rb.shapeSize[0] * 1.1,
            })))
          }
          else if (rb.shapeType === PmxObject.RigidBody.ShapeType.Capsule) {
            addCollider(bone, new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Capsule shapeSize [radius, height, ignore]
              radius: rb.shapeSize[0] * 1.1,
              tail: offsetLocal.clone().add(dirSeg.clone().multiplyScalar(Math.min(rb.shapeSize[1], boneLen))),
            })))
          }
          else {
            // Maybe box shape
            addCollider(bone, new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({
              offset: offsetLocal,
              // Box shapeSize [width, height, depth]
              radius: Math.max(rb.shapeSize[0], rb.shapeSize[2]) * 1.1,
              tail: offsetLocal.clone().add(dirSeg.clone().multiplyScalar(Math.min(rb.shapeSize[1], boneLen))),
            })))
          }
        })
      }
      else {
        // No rigid body for this leg bone, add a default collider
        const radius = Math.min(boneLen * 0.1 * 1.2, boneLen * 0.5)
        const tail = dirSeg.clone().multiplyScalar(boneLen)
        addCollider(bone, new VRMSpringBoneCollider(
          new VRMSpringBoneColliderShapeCapsule({ radius, tail }),
        ))
      }
    })
  }

  // Initialize once on creation
  setupColliders()
  setupHairJoints()
  setupSkirtJoints()
  joints.forEach(j => manager.addJoint(j))
  mmd.mesh.updateMatrixWorld(true)
  manager.setInitState()
  cacheJointsAndColliders()

  const applyGravity = () => {
    const magnitude = gravity.length() * modelScale
    const direction = magnitude > 0 ? gravity.clone().normalize() : new Vector3(0, -1, 0)

    joints.forEach((joint) => {
      const base = baseJointSizes.get(joint)
      joint.settings.gravityDir.copy(direction)
      joint.settings.gravityPower = magnitude * (base?.gravityPower ?? 0)
    })
  }

  applyGravity()

  return {
    createHelper: <T>() => ({
      colliderHelpers: colliders.map(c => new VRMSpringBoneColliderHelper(c)),
      jointHelpers: joints.map(j => new VRMSpringBoneJointHelper(j)),
    }) as T,

    dispose: () => {
      colliders.forEach(collider => collider.parent?.remove(collider))
      joints.forEach(joint => manager.deleteJoint(joint))
      manager = new VRMSpringBoneManager()
      colliders.length = 0
      joints.length = 0
      baseColliderShapes.clear()
      baseJointSizes.clear()
      accumulator = 0
    },

    reset: () => {
      accumulator = 0
      manager.reset()
    },

    setGravity: (value: Vector3) => {
      gravity.copy(value)
      applyGravity()
    },

    // https://github.com/pixiv/three-vrm/blob/dev/guides/spring-bones-on-scaled-models.md
    setScalar: (scale: number) => {
      modelScale = scale
      joints.forEach((joint) => {
        const base = baseJointSizes.get(joint)
        if (!base)
          return

        joint.settings.hitRadius = base.hitRadius * scale
        // Stiffness acts on a unit direction and is not a spatial length.
        // Scaling it with the mesh makes MMD skirts lose their radial shape.
        joint.settings.stiffness = base.stiffness
      })

      colliders.forEach((collider) => {
        const base = baseColliderShapes.get(collider)
        if (!base)
          return

        const shape = collider.shape
        if (shape instanceof VRMSpringBoneColliderShapeSphere) {
          shape.radius = base.radius * scale
        }
        else if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
          shape.radius = base.radius * scale
          // tail is transformed by colliderMatrix, which already contains
          // the mesh scale. Scaling it here would shrink the capsule twice.
          shape.tail = base.tail!.clone()
        }
      })

      mmd.mesh.updateMatrixWorld(true)
      applyGravity()
      accumulator = 0
      manager.setInitState()
    },

    update: (delta: number) => {
      if (!Number.isFinite(delta) || delta <= 0)
        return

      // Keep the Verlet integration stable when the render loop stalls. The
      // manager itself is stepped at a fixed rate like MMD's rigid-body
      // implementation.
      accumulator += Math.min(delta, 0.1)
      const step = 1 / 60
      while (accumulator >= step) {
        manager.update(step)
        accumulator -= step
      }
    },
  }
}

export const MMDSpringBonePlugin = createPhysicsPlugin(
  name,
  MMDSpringBonePhysics,
)
