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

  private animationPose?: { position: Vector3, rotation: Quaternion }[]
  private readonly boneOrder: number[]
  private ikRotations: Quaternion[]

  constructor(pmx: PmxObject, mesh: SkinnedMesh) {
    this.pmx = pmx
    this.mesh = mesh
    this.scale = 1
    this.ikRotations = pmx.bones.map(() => new Quaternion())
    this.ikSolver = new MMDIKSolver(mesh, pmx, this.ikRotations)
    this.grantSolver = new GrantSolver(mesh, pmx, this.ikRotations)
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
  public beforePhysics(options: MMDUpdateOptions = {}, mixer?: AnimationMixer) {
    this.applyAnimationPropertyTrack(mixer)
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

  public updateWithMixer(
    delta: number,
    mixer: AnimationMixer,
    options: MMDUpdateOptions = {},
  ) {
    this.beforeUpdate()
    mixer.update(delta)
    this.applyAnimationPropertyTrack(mixer)

    this.beforePhysics(options, mixer)
    if (options.physics !== false)
      this.physics?.update(delta)
    this.afterPhysics(options)
  }

  private applyAnimationPropertyTrack(mixer?: AnimationMixer) {
    if (mixer == null)
      return

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

    if (activePropertyTrack == null || activePropertyTrack.frameNumbers.length === 0)
      return

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

    const frameIndex = Math.max(0, low - 1)
    const boneIndicesByName = new Map<string, number>()
    this.pmx.bones.forEach((bone, boneIndex) => boneIndicesByName.set(bone.name, boneIndex))

    for (let i = 0; i < activePropertyTrack.ikBoneNames.length; i++) {
      const boneIndex = boneIndicesByName.get(activePropertyTrack.ikBoneNames[i])
      if (boneIndex === undefined || this.pmx.bones[boneIndex].ik === undefined)
        continue

      const enabled = activePropertyTrack.ikStates[i]?.[frameIndex]
      if (enabled != null && this.ikSolver.isEnabled(boneIndex) !== enabled)
        this.ikSolver.setEnabled(boneIndex, enabled)
    }
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
