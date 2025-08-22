import type { Vmd } from '@noname0310/mmd-parser'
import type { SkinnedMesh } from 'three'

import { AnimationClip, Euler, Quaternion, Vector3 } from 'three'

export class AnimationBuilder {
  _createTrack(node, typedKeyframeTrack, times, values, interpolations) {
    /*
			 * optimizes here not to let KeyframeTrackPrototype optimize
			 * because KeyframeTrackPrototype optimizes times and values but
			 * doesn't optimize interpolations.
			 */
    if (times.length > 2) {
      times = times.slice()
      values = values.slice()
      interpolations = interpolations.slice()

      const stride = values.length / times.length
      const interpolateStride = interpolations.length / times.length

      let index = 1

      for (let aheadIndex = 2, endIndex = times.length; aheadIndex < endIndex; aheadIndex++) {
        for (let i = 0; i < stride; i++) {
          if (values[index * stride + i] !== values[(index - 1) * stride + i]
            || values[index * stride + i] !== values[aheadIndex * stride + i]) {
            index++
            break
          }
        }

        if (aheadIndex > index) {
          times[index] = times[aheadIndex]

          for (let i = 0; i < stride; i++) {
            values[index * stride + i] = values[aheadIndex * stride + i]
          }

          for (let i = 0; i < interpolateStride; i++) {
            interpolations[index * interpolateStride + i] = interpolations[aheadIndex * interpolateStride + i]
          }
        }
      }

      times.length = index + 1
      values.length = (index + 1) * stride
      interpolations.length = (index + 1) * interpolateStride
    }

    const track = new typedKeyframeTrack(node, times, values)

    track.createInterpolant = function InterpolantFactoryMethodCubicBezier(result) {
      return new CubicBezierInterpolation(this.times, this.values, this.getValueSize(), result, new Float32Array(interpolations))
    }

    return track
  }

  build(vmd: Vmd, mesh: SkinnedMesh): AnimationClip {
    // combine skeletal and morph animations

    const tracks = this.buildSkeletalAnimation(vmd, mesh).tracks
    const tracks2 = this.buildMorphAnimation(vmd, mesh).tracks

    for (let i = 0, il = tracks2.length; i < il; i++) {
      tracks.push(tracks2[i])
    }

    return new AnimationClip('', -1, tracks)
  }

  buildCameraAnimation(vmd: Vmd): AnimationClip {
    const pushVector3 = (array: number[], vec: Vector3) => {
      array.push(vec.x)
      array.push(vec.y)
      array.push(vec.z)
    }

    const pushQuaternion = (array: number[], q: Quaternion) => {
      array.push(q.x)
      array.push(q.y)
      array.push(q.z)
      array.push(q.w)
    }

    const pushInterpolation = (array: number[], interpolation: number[], index: number) => {
      array.push(interpolation[index * 4 + 0] / 127) // x1
      array.push(interpolation[index * 4 + 1] / 127) // x2
      array.push(interpolation[index * 4 + 2] / 127) // y1
      array.push(interpolation[index * 4 + 3] / 127) // y2
    }

    const cameras = vmd.cameras === undefined ? [] : vmd.cameras.slice()

    cameras.sort((a, b) => {
      return a.frameNum - b.frameNum
    })

    const times = []
    const centers = []
    const quaternions = []
    const positions = []
    const fovs = []

    const cInterpolations = []
    const qInterpolations = []
    const pInterpolations = []
    const fInterpolations = []

    const quaternion = new Quaternion()
    const euler = new Euler()
    const position = new Vector3()
    const center = new Vector3()

    for (let i = 0, il = cameras.length; i < il; i++) {
      const motion = cameras[i]

      const time = motion.frameNum / 30
      const pos = motion.position
      const rot = motion.rotation
      const distance = motion.distance
      const fov = motion.fov
      const interpolation = motion.interpolation

      times.push(time)

      position.set(0, 0, -distance)
      center.set(pos[0], pos[1], pos[2])

      euler.set(-rot[0], -rot[1], -rot[2])
      quaternion.setFromEuler(euler)

      position.add(center)
      position.applyQuaternion(quaternion)

      pushVector3(centers, center)
      pushQuaternion(quaternions, quaternion)
      pushVector3(positions, position)

      fovs.push(fov)

      for (let j = 0; j < 3; j++) {
        pushInterpolation(cInterpolations, interpolation, j)
      }

      pushInterpolation(qInterpolations, interpolation, 3)

      // use the same parameter for x, y, z axis.
      for (let j = 0; j < 3; j++) {
        pushInterpolation(pInterpolations, interpolation, 4)
      }

      pushInterpolation(fInterpolations, interpolation, 5)
    }

    const tracks = []

    // I expect an object whose name 'target' exists under THREE.Camera
    tracks.push(this._createTrack('target.position', VectorKeyframeTrack, times, centers, cInterpolations))

    tracks.push(this._createTrack('.quaternion', QuaternionKeyframeTrack, times, quaternions, qInterpolations))
    tracks.push(this._createTrack('.position', VectorKeyframeTrack, times, positions, pInterpolations))
    tracks.push(this._createTrack('.fov', NumberKeyframeTrack, times, fovs, fInterpolations))

    return new AnimationClip('', -1, tracks)
  }

  buildMorphAnimation(vmd: Vmd, mesh: SkinnedMesh): AnimationClip {
    const tracks = []

    const morphs = {}
    const morphTargetDictionary = mesh.morphTargetDictionary

    for (let i = 0; i < vmd.metadata.morphCount; i++) {
      const morph = vmd.morphs[i]
      const morphName = morph.morphName

      if (morphTargetDictionary?.[morphName] === undefined)
        continue

      morphs[morphName] = morphs[morphName] || []
      morphs[morphName].push(morph)
    }

    for (const key in morphs) {
      const array = morphs[key]

      array.sort((a, b) => {
        return a.frameNum - b.frameNum
      })

      const times = []
      const values = []

      for (let i = 0, il = array.length; i < il; i++) {
        times.push(array[i].frameNum / 30)
        values.push(array[i].weight)
      }

      tracks.push(new NumberKeyframeTrack(`.morphTargetInfluences[${morphTargetDictionary[key]}]`, times, values))
    }

    return new AnimationClip('', -1, tracks)
  }

  // private method
  buildSkeletalAnimation(vmd: Vmd, mesh: SkinnedMesh): AnimationClip {
    const pushInterpolation = (array: number[], interpolation: number[], index: number) => {
      array.push(interpolation[index + 0] / 127) // x1
      array.push(interpolation[index + 8] / 127) // x2
      array.push(interpolation[index + 4] / 127) // y1
      array.push(interpolation[index + 12] / 127) // y2
    }

    const tracks = []

    const motions = {}
    const bones = mesh.skeleton.bones
    const boneNameDictionary = {}

    for (let i = 0, il = bones.length; i < il; i++) {
      boneNameDictionary[bones[i].name] = true
    }

    for (let i = 0; i < vmd.metadata.motionCount; i++) {
      const motion = vmd.motions[i]
      const boneName = motion.boneName

      if (boneNameDictionary[boneName] === undefined)
        continue

      motions[boneName] = motions[boneName] || []
      motions[boneName].push(motion)
    }

    for (const key in motions) {
      const array = motions[key]

      array.sort((a, b) => {
        return a.frameNum - b.frameNum
      })

      const times = []
      const positions = []
      const rotations = []
      const pInterpolations = []
      const rInterpolations = []

      const basePosition = mesh.skeleton.getBoneByName(key).position.toArray()

      for (let i = 0, il = array.length; i < il; i++) {
        const time = array[i].frameNum / 30
        const position = array[i].position
        const rotation = array[i].rotation
        const interpolation = array[i].interpolation

        times.push(time)

        for (let j = 0; j < 3; j++) positions.push(basePosition[j] + position[j])
        for (let j = 0; j < 4; j++) rotations.push(rotation[j])
        for (let j = 0; j < 3; j++) pushInterpolation(pInterpolations, interpolation, j)

        pushInterpolation(rInterpolations, interpolation, 3)
      }

      const targetName = `.bones[${key}]`

      tracks.push(this._createTrack(`${targetName}.position`, VectorKeyframeTrack, times, positions, pInterpolations))
      tracks.push(this._createTrack(`${targetName}.quaternion`, QuaternionKeyframeTrack, times, rotations, rInterpolations))
    }

    return new AnimationClip('', -1, tracks)
  }
}
