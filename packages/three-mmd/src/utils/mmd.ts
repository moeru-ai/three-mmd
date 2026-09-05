import type { AnimationAction, AnimationMixer, SkinnedMesh, Vector3 } from 'three'

import type { PhysicsFactory, PhysicsService } from '../physics/physics-service'
import type { MMDAnimationUserData } from './build-animation'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Quaternion } from 'three'

import { GrantSolver } from '../physics/grant-solver'
import { MMDIKSolver } from '../physics/mmd-ik-solver'

export interface MMDUpdateOptions {
  grant?: boolean
  ik?: boolean
  physics?: boolean
}

const getActiveActions = (mixer: AnimationMixer): readonly AnimationAction[] => {
  const internal = mixer as unknown as {
    _actions?: AnimationAction[]
    _nActiveActions?: number
  }
  return internal._actions?.slice(0, internal._nActiveActions) ?? []
}

/**
 * MMD model shell: holds parsed PMX, skinned mesh, IK/grants, and pluggable physics strategy.
 * Lifecycle methods update scale/physics, helpers expose collider/joint visualization when available.
 */
export class MMD {
  public grantSolver: GrantSolver
  public ikSolver: MMDIKSolver
  public mesh: SkinnedMesh
  public physics?: PhysicsService
  public pmx: PmxObject
  public scale: number

  private readonly animationControlledIKBones = new Map<number, boolean>()
  private animationPose?: { position: Vector3, rotation: Quaternion }[]
  private readonly boneOrder: number[]
  private readonly currentAnimationControlledIKBones = new Set<number>()
  private readonly ikBoneIndicesByName = new Map<string, number>()
  private ikRotations: Quaternion[]
  private readonly normalizedIkBoneIndicesByName = new Map<string, number>()

  constructor(pmx: PmxObject, mesh: SkinnedMesh) {
    this.pmx = pmx
    this.mesh = mesh
    this.scale = 1
    this.ikRotations = pmx.bones.map(() => new Quaternion())
    this.ikSolver = new MMDIKSolver(mesh, pmx, this.ikRotations)
    this.grantSolver = new GrantSolver(mesh, pmx, this.ikRotations)
    pmx.bones.forEach((bone, boneIndex) => {
      if (bone.ik === undefined)
        return

      this.ikBoneIndicesByName.set(bone.name, boneIndex)

      const normalizedName = bone.name.normalize('NFKC')
      if (!this.normalizedIkBoneIndicesByName.has(normalizedName))
        this.normalizedIkBoneIndicesByName.set(normalizedName, boneIndex)
    })
    this.boneOrder = pmx.bones.map((_, index) => index).sort((a, b) =>
      pmx.bones[a].transformOrder - pmx.bones[b].transformOrder || a - b,
    )
  }

  /** Evaluates post-physics bones after the physics service writes back its pose. */
  public afterPhysics(options: MMDUpdateOptions = {}) {
    this.updateBones(true, options)
    this.grantSolver.endFrame()
    this.ikSolver.endFrame()
  }

  /** Restores unchanged solver output, captures the input, and evaluates pre-physics bones. */
  public beforePhysics(options: MMDUpdateOptions = {}) {
    this.grantSolver.beginFrame()
    this.ikSolver.beginFrame()
    const bones = this.mesh.skeleton.bones
    this.animationPose ??= bones.map(bone => ({
      position: bone.position.clone(),
      rotation: bone.quaternion.clone(),
    }))
    this.animationPose.forEach((pose, index) => {
      pose.position.copy(bones[index].position)
      pose.rotation.copy(bones[index].quaternion)
    })
    this.updateBones(false, options)
  }

  /**
   * Restores the skeletal pose sampled by the previous animation frame.
   *
   * Call this immediately before the animation mixer updates the mesh.
   */
  public beforeUpdate() {
    this.animationPose?.forEach((pose, index) => {
      const bone = this.mesh.skeleton.bones[index]
      bone.position.copy(pose.position)
      bone.quaternion.copy(pose.rotation)
    })
    this.grantSolver.reset()
    this.ikSolver.reset()
  }

  public dispose() {
    this.physics?.dispose?.()
    this.physics = undefined
    this.animationPose = undefined
  }

  public setPhysics(createPhysics: PhysicsFactory) {
    if (this.physics)
      throw new Error('MMD: Physics has already been installed.')

    const physics = createPhysics(this)
    this.physics = physics
    physics.setScalar?.(this.scale)
  }

  public setScalar(scale: number) {
    if (this.scale === scale)
      return

    this.scale = scale
    this.mesh.scale.setScalar(scale)
    this.mesh.updateMatrixWorld(true)
    this.physics?.setScalar?.(scale)
  }

  /**
   * Applies MMD-specific pose processing after an animation mixer updates the mesh.
   *
   * The ordering is significant: the mixer pose is cached before IK and append
   * transforms mutate the bones, so the next frame can start from an unmodified
   * animation pose. Call beforeUpdate() before advancing an external mixer.
   */
  public update(delta: number, options: MMDUpdateOptions = {}) {
    this.beforePhysics(options)
    if (options.physics !== false)
      this.physics?.update(delta)
    this.afterPhysics(options)
  }

  public updateAnimation(mixer?: AnimationMixer) {
    this.currentAnimationControlledIKBones.clear()

    if (mixer != null) {
      const animationActions = getActiveActions(mixer)
      let activePropertyTrack: MMDAnimationUserData['propertyTrack']
      let activeActionTime = 0
      let activeWeight = 0

      for (const action of animationActions) {
        const propertyTrack = (action.getClip().userData as MMDAnimationUserData).propertyTrack
        if (propertyTrack == null)
          continue

        const weight = action.getEffectiveWeight()
        if (weight <= activeWeight)
          continue

        activePropertyTrack = propertyTrack
        activeActionTime = action.time
        activeWeight = weight
      }

      if (activePropertyTrack != null && activePropertyTrack.frameNumbers.length > 0) {
        const frameNumber = activeActionTime * 30
        let low = 0
        let high = activePropertyTrack.frameNumbers.length
        while (low < high) {
          const middle = (low + high) >>> 1
          if (activePropertyTrack.frameNumbers[middle] <= frameNumber)
            low = middle + 1
          else
            high = middle
        }

        const frameIndex = low - 1
        if (frameIndex >= 0) {
          for (let i = 0; i < activePropertyTrack.ikBoneNames.length; i++) {
            const ikBoneName = activePropertyTrack.ikBoneNames[i]
            const boneIndex = this.ikBoneIndicesByName.get(ikBoneName)
              ?? this.normalizedIkBoneIndicesByName.get(ikBoneName.normalize('NFKC'))
            if (boneIndex === undefined)
              continue

            const enabled = activePropertyTrack.ikStates[i]?.[frameIndex]
            if (enabled == null)
              continue

            if (!this.animationControlledIKBones.has(boneIndex))
              this.animationControlledIKBones.set(boneIndex, this.ikSolver.isEnabled(boneIndex))
            this.currentAnimationControlledIKBones.add(boneIndex)
            if (this.ikSolver.isEnabled(boneIndex) !== enabled)
              this.ikSolver.setEnabled(boneIndex, enabled)
          }
        }
      }
    }

    for (const [boneIndex, enabled] of this.animationControlledIKBones) {
      if (this.currentAnimationControlledIKBones.has(boneIndex))
        continue

      if (this.ikSolver.isEnabled(boneIndex) !== enabled)
        this.ikSolver.setEnabled(boneIndex, enabled)
      this.animationControlledIKBones.delete(boneIndex)
    }
  }

  public updateWithMixer(
    delta: number,
    mixer: AnimationMixer,
    options: MMDUpdateOptions = {},
  ) {
    this.beforeUpdate()
    mixer.update(delta)
    this.updateAnimation(mixer)
    this.update(delta, options)
  }

  private updateBones(afterPhysics: boolean, options: MMDUpdateOptions) {
    this.mesh.updateMatrixWorld(true)
    const physicsAffectsIK = options.physics !== false && this.physics?.affectsIK === true
    for (const boneIndex of this.boneOrder) {
      const flag = this.pmx.bones[boneIndex].flag
      if (((flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0) !== afterPhysics)
        continue
      if (options.grant !== false)
        this.grantSolver.updateBone(boneIndex)
      if (options.ik !== false)
        this.ikSolver.updateBone(boneIndex, physicsAffectsIK)
    }
    this.mesh.updateMatrixWorld(true)
  }
}
