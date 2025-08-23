import type { Audio } from 'three'

export interface AudioManagerParameter {
  delayTime?: number
}

export class AudioManager {
  audio: Audio
  audioDuration: number
  currentTime: number
  delayTime: number
  duration: number
  elapsedTime: number

  constructor(audio: Audio, params: AudioManagerParameter = {}) {
    this.audio = audio

    this.elapsedTime = 0.0
    this.currentTime = 0.0
    this.delayTime = params.delayTime !== undefined
      ? params.delayTime
      : 0.0

    // TODO: handle
    this.audioDuration = this.audio.buffer!.duration
    this.duration = this.audioDuration + this.delayTime
  }

  control(delta: number) {
    this.elapsedTime += delta
    this.currentTime += delta

    if (this.shouldStopAudio())
      this.audio.stop()
    if (this.shouldStartAudio())
      this.audio.play()

    return this
  }

  private shouldStartAudio() {
    if (this.audio.isPlaying)
      return false

    while (this.currentTime >= this.duration) {
      this.currentTime -= this.duration
    }

    if (this.currentTime < this.delayTime)
      return false

    // 'duration' can be bigger than 'audioDuration + delayTime' because of sync configuration
    return this.currentTime - this.delayTime <= this.audioDuration
  }

  private shouldStopAudio() {
    return this.audio.isPlaying
      && this.currentTime >= this.duration
  }
}
