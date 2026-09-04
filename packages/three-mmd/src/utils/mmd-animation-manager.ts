import type {
  AnimationClip,
  Audio,
  Camera,
} from 'three'

import type { MMDUpdateOptions } from './mmd'

import { AnimationMixer, Object3D } from 'three'

import { MMD } from './mmd'

export interface AudioAnimationOptions {
  delayTime?: number
}

export interface MMDAnimationOptions {
  animation?: AnimationClip | AnimationClip[]
}

const playAnimation = (
  mixer: AnimationMixer,
  animation?: AnimationClip | AnimationClip[],
  duration?: number,
) => {
  if (animation == null)
    return

  const animations = (Array.isArray(animation) ? animation : [animation]) as readonly AnimationClip[]
  animations.forEach((clip) => {
    if (duration != null) {
      clip = clip.clone()
      clip.duration = duration
    }

    mixer.clipAction(clip).play()
  })
}

/** Coordinates MMD, camera, and audio animation on a single render-loop update. */
export class MMDAnimationManager {
  private audio?: Audio
  private audioDelay = 0
  private audioDuration?: number

  private audioElapsed = 0
  private audioStarted = false
  private audioStartedByManager = false

  private camera?: Camera
  private cameraMixer?: AnimationMixer
  private cameraTarget?: Object3D
  private readonly duration?: number
  private readonly models = new Map<MMD, AnimationMixer>()

  public constructor(options: { duration?: number } = {}) {
    if (options.duration != null && (!Number.isFinite(options.duration) || options.duration <= 0))
      throw new RangeError('MMDAnimationManager: duration must be a positive finite number.')

    this.duration = options.duration
  }

  public add(mmd: MMD, options?: MMDAnimationOptions): this
  public add(camera: Camera, options?: MMDAnimationOptions): this
  public add(audio: Audio, options?: AudioAnimationOptions): this
  public add(
    object: Audio | Camera | MMD,
    options: AudioAnimationOptions | MMDAnimationOptions = {},
  ): this {
    if (object instanceof MMD) {
      if (this.models.has(object))
        throw new Error('MMDAnimationManager: MMD has already been added.')

      const mmdOptions = options as MMDAnimationOptions
      const mixer = new AnimationMixer(object.mesh)
      const { animation } = mmdOptions

      mixer.addEventListener('loop', (event) => {
        if (!event.action.getClip().tracks.some(track => track.name.startsWith('.bones'))) {
          return
        }

        object.physics?.reset?.()
      })

      this.models.set(object, mixer)
      playAnimation(mixer, animation, this.duration)
      return this
    }
    else if ('isCamera' in object) {
      if (this.camera !== undefined)
        throw new Error('MMDAnimationManager: Camera has already been added.')

      const cameraOptions = options as MMDAnimationOptions
      this.camera = object

      if (cameraOptions.animation != null) {
        const target = new Object3D()
        target.name = 'target'

        object.add(target)
        this.cameraTarget = target
        this.cameraMixer = new AnimationMixer(object)
        playAnimation(this.cameraMixer, cameraOptions.animation, this.duration)
      }

      return this
    }
    else if (object.type === 'Audio') {
      if (this.audio !== undefined)
        throw new Error('MMDAnimationManager: Audio has already been added.')

      const audioOptions = options as AudioAnimationOptions
      this.audio = object
      this.audioDelay = audioOptions.delayTime ?? 0
      this.audioDuration = object.buffer?.duration
      this.audioElapsed = 0
      this.audioStarted = object.isPlaying
      this.audioStartedByManager = false
      return this
    }
    else {
      throw new TypeError('MMDAnimationManager.add: expected an MMD, Camera, or Audio.')
    }
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
      if (mixer == null)
        return this

      mixer.stopAllAction()
      mixer.uncacheRoot(object.mesh)
      this.models.delete(object)
      return this
    }
    else if ('isCamera' in object) {
      if (this.camera !== object)
        return this

      if (this.cameraMixer != null) {
        this.cameraMixer.stopAllAction()
        this.cameraMixer.uncacheRoot(object)
      }
      if (this.cameraTarget?.parent === object)
        object.remove(this.cameraTarget)

      this.camera = undefined
      this.cameraMixer = undefined
      this.cameraTarget = undefined
      return this
    }
    else if (object.type === 'Audio') {
      if (this.audio !== object)
        return this

      if (this.audioStartedByManager && object.isPlaying)
        object.stop()

      this.audio = undefined
      this.audioDelay = 0
      this.audioDuration = undefined
      this.audioElapsed = 0
      this.audioStarted = false
      this.audioStartedByManager = false
      return this
    }
    else {
      throw new Error('MMDAnimationManager.remove: expected an MMD, Camera, or Audio.')
    }
  }

  public update(delta: number, options?: MMDUpdateOptions): this {
    this.updateAudio(delta)

    for (const [mmd, mixer] of this.models)
      mmd.updateWithMixer(delta, mixer, options)

    if (this.camera != null && this.cameraMixer != null && this.cameraTarget != null) {
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
    if (this.audio == null)
      return

    this.audioElapsed += delta

    if (this.duration != null) {
      while (this.audioElapsed >= this.duration) {
        this.audioElapsed -= this.duration
        if (this.audio.isPlaying)
          this.audio.stop()
        this.audioStarted = false
        this.audioStartedByManager = false
      }
    }

    const audioEnd = this.audioDuration == null
      ? Number.POSITIVE_INFINITY
      : this.audioDelay + this.audioDuration

    if (!this.audioStarted && this.audioElapsed >= this.audioDelay && this.audioElapsed <= audioEnd) {
      this.audioStarted = true
      if (!this.audio.isPlaying) {
        this.audio.play()
        this.audioStartedByManager = true
      }
    }
  }
}
