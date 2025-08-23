import type { AnimationClip, AnimationMixer, Audio, Bone, Camera, Object3D, Quaternion, SkinnedMesh } from 'three'
import type { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js'

import type { MMDPhysics } from './MMDPhysics'

export interface MMDAnimationHelperAddParameter {
  animation?: AnimationClip | AnimationClip[]
  delayTime?: number
  gravity?: number
  maxStepNum?: number
  physics?: boolean
  unitStep?: number
  warmup?: number
}

export interface MMDAnimationHelperMixer {
  duration?: number
  grantSolver: GrantSolver
  ikSolver: CCDIKSolver
  looped: boolean
  mixer?: AnimationMixer
  physics?: MMDPhysics
}

export interface MMDAnimationHelperParameter {
  afterglow?: number
  pmxAnimation?: boolean
  resetPhysicsOnLoop?: boolean
  sync?: boolean
}

export interface MMDAnimationHelperPoseParameter {
  grant?: boolean
  ik?: boolean
  resetPose?: boolean
}

export class GrantSolver {
  grants: object[]
  mesh: SkinnedMesh
  constructor(mesh: SkinnedMesh, grants: object[])

  addGrantRotation(bone: Bone, q: Quaternion, ratio: number): this
  update(): this
  updateOne(gran: object[]): this
}

export class MMDAnimationHelper {
  audio: Audio
  audioManager: AudioManager
  camera: Camera | null
  cameraTarget: Object3D
  configuration: {
    afterglow: number
    pmxAnimation: boolean
    resetPhysicsOnLoop: boolean
    sync: boolean
  }

  enabled: {
    animation: boolean
    cameraAnimation: boolean
    grant: boolean
    ik: boolean
    physics: boolean
  }

  masterPhysics: null

  meshes: SkinnedMesh[]

  objects: WeakMap<AudioManager | Camera | SkinnedMesh, MMDAnimationHelperMixer>
  onBeforePhysics: (mesh: SkinnedMesh) => void
  sharedPhysics: boolean
  constructor(params?: MMDAnimationHelperParameter)

  add(object: Audio | Camera | SkinnedMesh, params?: MMDAnimationHelperAddParameter): this
  createGrantSolver(mesh: SkinnedMesh): GrantSolver
  enable(key: string, enabled: boolean): this
  pose(mesh: SkinnedMesh, vpd: object, params?: MMDAnimationHelperPoseParameter): this
  remove(object: Audio | Camera | SkinnedMesh): this
  update(delta: number): this
}
