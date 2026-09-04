import type {
  AnimationClip,
  AnimationMixer,
  Audio,
  Camera,
  Object3D,
} from 'three'

import type { MMDUpdateOptions } from './mmd'

import { AnimationMixer as ThreeAnimationMixer, Object3D as ThreeObject3D } from 'three'

import { MMD } from './mmd'

export interface AudioAnimationOptions {
  delayTime?: number
}

export interface CameraAnimationOptions {
  animation?: MMDAnimation
  target?: Object3D
}

export type MMDAnimation = AnimationClip | readonly AnimationClip[]

export interface MMDAnimationOptions extends MMDUpdateOptions {
  animation?: MMDAnimation
}

const playAnimation = (mixer: AnimationMixer, animation: MMDAnimation | undefined) => {
  if (animation === undefined)
    return

  const animations = (Array.isArray(animation) ? animation : [animation]) as readonly AnimationClip[]
  animations.forEach(clip => mixer.clipAction(clip).play())
}

const isCamera = (object: Audio | Camera): object is Camera =>
  'isCamera' in object && object.isCamera === true

/** Coordinates MMD, camera, and audio animation on a single render-loop update. */
export class MMDAnimationManager {
  private audio?: Audio
  private audioDelay = 0

  private audioElapsed = 0
  private audioStarted = false
  private audioStartedByManager = false

  private camera?: Camera
  private cameraMixer?: AnimationMixer
  private cameraTarget?: Object3D
  private readonly modelOptions = new Map<MMD, MMDUpdateOptions>()
  private readonly models = new Map<MMD, AnimationMixer>()

  public add(mmd: MMD, options?: MMDAnimationOptions): this
  public add(camera: Camera, options?: CameraAnimationOptions): this
  public add(audio: Audio, options?: AudioAnimationOptions): this
  public add(
    object: Audio | Camera | MMD,
    options: AudioAnimationOptions | CameraAnimationOptions | MMDAnimationOptions = {},
  ): this {
    if (object instanceof MMD) {
      if (this.models.has(object))
        throw new Error('MMDAnimationManager: MMD has already been added.')

      const mmdOptions = options as MMDAnimationOptions
      const mixer = new ThreeAnimationMixer(object.mesh)
      const { animation, grant, ik, physics } = mmdOptions

      this.models.set(object, mixer)
      this.modelOptions.set(object, { grant, ik, physics })
      playAnimation(mixer, animation)
      return this
    }

    if (isCamera(object)) {
      if (this.camera !== undefined)
        throw new Error('MMDAnimationManager: Camera has already been added.')

      const cameraOptions = options as CameraAnimationOptions
      const target = cameraOptions.target ?? new ThreeObject3D()
      target.name = 'target'

      object.add(target)
      this.camera = object
      this.cameraTarget = target
      this.cameraMixer = new ThreeAnimationMixer(object)
      playAnimation(this.cameraMixer, cameraOptions.animation)
      return this
    }

    if (object.type === 'Audio') {
      if (this.audio !== undefined)
        throw new Error('MMDAnimationManager: Audio has already been added.')

      const audioOptions = options as AudioAnimationOptions
      this.audio = object
      this.audioDelay = audioOptions.delayTime ?? 0
      this.audioElapsed = 0
      this.audioStarted = object.isPlaying
      this.audioStartedByManager = false
      return this
    }

    throw new Error('MMDAnimationManager.add: expected an MMD, Camera, or Audio.')
  }

  public dispose() {
    for (const mmd of this.models.keys())
      this.remove(mmd)

    if (this.camera !== undefined)
      this.remove(this.camera)

    if (this.audio !== undefined)
      this.remove(this.audio)
  }

  public remove(object: Audio | Camera | MMD): this {
    if (object instanceof MMD) {
      const mixer = this.models.get(object)
      if (mixer === undefined)
        return this

      mixer.stopAllAction()
      mixer.uncacheRoot(object.mesh)
      this.models.delete(object)
      this.modelOptions.delete(object)
      return this
    }

    if (isCamera(object)) {
      if (this.camera !== object || this.cameraMixer === undefined)
        return this

      this.cameraMixer.stopAllAction()
      this.cameraMixer.uncacheRoot(object)
      if (this.cameraTarget?.parent === object)
        object.remove(this.cameraTarget)

      this.camera = undefined
      this.cameraMixer = undefined
      this.cameraTarget = undefined
      return this
    }

    if (object.type === 'Audio') {
      if (this.audio !== object)
        return this

      if (this.audioStartedByManager && object.isPlaying)
        object.stop()

      this.audio = undefined
      this.audioDelay = 0
      this.audioElapsed = 0
      this.audioStarted = false
      this.audioStartedByManager = false
      return this
    }

    throw new Error('MMDAnimationManager.remove: expected an MMD, Camera, or Audio.')
  }

  public update(delta: number): this {
    this.updateAudio(delta)

    for (const [mmd, mixer] of this.models)
      mmd.updateWithMixer(delta, mixer, this.modelOptions.get(mmd))

    if (this.camera !== undefined && this.cameraMixer !== undefined && this.cameraTarget !== undefined) {
      this.cameraMixer.update(delta)
      const camera = this.camera as Camera & { updateProjectionMatrix?: () => void }
      camera.updateProjectionMatrix?.()
      this.camera.up.set(0, 1, 0)
      this.camera.up.applyQuaternion(this.camera.quaternion)
      this.camera.lookAt(this.cameraTarget.position)
    }

    return this
  }

  private updateAudio(delta: number) {
    if (this.audio === undefined)
      return

    this.audioElapsed += delta
    if (!this.audioStarted && this.audioElapsed >= this.audioDelay) {
      this.audioStarted = true
      if (!this.audio.isPlaying) {
        this.audio.play()
        this.audioStartedByManager = true
      }
    }
  }
}
