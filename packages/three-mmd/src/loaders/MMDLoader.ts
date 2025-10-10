/* eslint-disable sonarjs/redundant-type-aliases */
/* eslint-disable ts/strict-boolean-expressions */

/* eslint-disable sonarjs/different-types-comparison */
/* eslint-disable ts/no-unsafe-assignment */
/* eslint-disable ts/no-unsafe-member-access */
/* eslint-disable ts/no-unsafe-argument */

/* eslint-disable perfectionist/sort-classes */

import type { Pmd, Pmx, Vmd, VmdMorphFrame, VmdMotionFrame } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import {
  AnimationClip,
  Bone,
  Euler,
  Interpolant,
  NumberKeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three'

import { GeometryBuilder } from './mmd-loader/geometry-builder'
import { MaterialBuilder } from './mmd-loader/material-builder'

/**
 * Dependencies
 *  - mmd-parser https://github.com/takahirox/mmd-parser
 *  - TGALoader
 *  - OutlineEffect
 *
 * MMDLoader creates Three.js Objects from MMD resources as
 * PMD, PMX, VMD, and VPD files.
 *
 * PMD/PMX is a model data format, VMD is a motion data format
 * VPD is a posing data format used in MMD(Miku Miku Dance).
 *
 * MMD official site
 *  - https://sites.google.com/view/evpvp/
 *
 * PMD, VMD format (in Japanese)
 *  - http://blog.goo.ne.jp/torisu_tetosuki/e/209ad341d3ece2b1b4df24abf619d6e4
 *
 * PMX format
 *  - https://gist.github.com/felixjones/f8a06bd48f9da9a4539f
 *
 * TODO
 *  - light motion in vmd support.
 *  - SDEF support.
 *  - uv/material/bone morphing support.
 *  - more precise grant skinning support.
 *  - shadow support.
 */
const initBones = (mesh: SkinnedMesh & { geometry: { bones?: any[] } }) => {
  const geometry = mesh.geometry

  const bones = []

  if (geometry && geometry.bones !== undefined) {
    // first, create array of 'Bone' objects from geometry data

    for (let i = 0, il = geometry.bones.length; i < il; i++) {
      const gbone = geometry.bones[i]

      // create new 'Bone' object

      const bone = new Bone()
      bones.push(bone)

      // apply values

      bone.name = gbone.name
      bone.position.fromArray(gbone.pos)
      bone.quaternion.fromArray(gbone.rotq)
      if (gbone.scl !== undefined)
        bone.scale.fromArray(gbone.scl)
    }

    // second, create bone hierarchy

    for (let i = 0, il = geometry.bones.length; i < il; i++) {
      const gbone = geometry.bones[i]

      if ((gbone.parent !== -1) && (gbone.parent !== null) && (bones[gbone.parent] !== undefined)) {
        // subsequent bones in the hierarchy

        bones[gbone.parent].add(bones[i])
      }
      else {
        // topmost bone, immediate child of the skinned mesh

        mesh.add(bones[i])
      }
    }
  }

  // now the bones are part of the scene graph and children of the skinned mesh.
  // let's update the corresponding matrices

  mesh.updateMatrixWorld(true)

  return bones
}

export interface MMDLoaderAnimationObject {
  animation: AnimationClip
  mesh: SkinnedMesh
}

class CubicBezierInterpolation extends Interpolant {
  readonly interpolationParams: ArrayLike<number>
  declare parameterPositions: ArrayLike<number>
  declare resultBuffer: number[]
  declare sampleSize: number
  declare sampleValues: ArrayLike<number>

  constructor(
    parameterPositions: ArrayLike<number>,
    sampleValues: ArrayLike<number>,
    sampleSize: number,
    resultBuffer: number[],
    params: ArrayLike<number>,
  ) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer)

    this.interpolationParams = params
  }

  _calculate(x1: number, x2: number, y1: number, y2: number, x: number): number {
    /*
     * Cubic Bezier curves
     *   https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B.C3.A9zier_curves
     *
     * B(t) = ( 1 - t ) ^ 3 * P0
     *      + 3 * ( 1 - t ) ^ 2 * t * P1
     *      + 3 * ( 1 - t ) * t^2 * P2
     *      + t ^ 3 * P3
     *      ( 0 <= t <= 1 )
     *
     * MMD uses Cubic Bezier curves for bone and camera animation interpolation.
     *   http://d.hatena.ne.jp/edvakf/20111016/1318716097
     *
     *    x = ( 1 - t ) ^ 3 * x0
     *      + 3 * ( 1 - t ) ^ 2 * t * x1
     *      + 3 * ( 1 - t ) * t^2 * x2
     *      + t ^ 3 * x3
     *    y = ( 1 - t ) ^ 3 * y0
     *      + 3 * ( 1 - t ) ^ 2 * t * y1
     *      + 3 * ( 1 - t ) * t^2 * y2
     *      + t ^ 3 * y3
     *      ( x0 = 0, y0 = 0 )
     *      ( x3 = 1, y3 = 1 )
     *      ( 0 <= t, x1, x2, y1, y2 <= 1 )
     *
     * Here solves this equation with Bisection method,
     *   https://en.wikipedia.org/wiki/Bisection_method
     * gets t, and then calculate y.
     *
     * f(t) = 3 * ( 1 - t ) ^ 2 * t * x1
     *      + 3 * ( 1 - t ) * t^2 * x2
     *      + t ^ 3 - x = 0
     *
     * (Another option: Newton's method
     *    https://en.wikipedia.org/wiki/Newton%27s_method)
     */

    let c = 0.5
    let t = c
    let s = 1.0 - t
    const loop = 15
    const eps = 1e-5
    const math = Math

    let sst3: number, stt3: number, ttt: number

    for (let i = 0; i < loop; i++) {
      sst3 = 3.0 * s * s * t
      stt3 = 3.0 * s * t * t
      ttt = t * t * t

      const ft = (sst3 * x1) + (stt3 * x2) + (ttt) - x

      if (math.abs(ft) < eps)
        break

      c /= 2.0

      t += (ft < 0) ? c : -c
      s = 1.0 - t
    }

    return (sst3! * y1) + (stt3! * y2) + ttt!
  }

  interpolate_(i1: number, t0: number, t: number, t1: number): number[] {
    const result = this.resultBuffer
    const values = this.sampleValues as number[]
    const stride = this.valueSize
    const params = this.interpolationParams

    const offset1 = i1 * stride
    const offset0 = offset1 - stride

    // No interpolation if next key frame is in one frame in 30fps.
    // This is from MMD animation spec.
    // '1.5' is for precision loss. times are Float32 in Three.js Animation system.
    const weight1 = ((t1 - t0) < 1 / 30 * 1.5) ? 0.0 : (t - t0) / (t1 - t0)

    if (stride === 4) { // Quaternion
      const x1 = params[i1 * 4 + 0]
      const x2 = params[i1 * 4 + 1]
      const y1 = params[i1 * 4 + 2]
      const y2 = params[i1 * 4 + 3]

      const ratio = this._calculate(x1, x2, y1, y2, weight1)

      Quaternion.slerpFlat(result, 0, values, offset0, values, offset1, ratio)
    }
    else if (stride === 3) { // Vector3
      for (let i = 0; i < stride; ++i) {
        const x1 = params[i1 * 12 + i * 4 + 0]
        const x2 = params[i1 * 12 + i * 4 + 1]
        const y1 = params[i1 * 12 + i * 4 + 2]
        const y2 = params[i1 * 12 + i * 4 + 3]

        const ratio = this._calculate(x1, x2, y1, y2, weight1)

        result[i] = values[offset0 + i] * (1 - ratio) + values[offset1 + i] * ratio
      }
    }
    else { // Number
      const x1 = params[i1 * 4 + 0]
      const x2 = params[i1 * 4 + 1]
      const y1 = params[i1 * 4 + 2]
      const y2 = params[i1 * 4 + 3]

      const ratio = this._calculate(x1, x2, y1, y2, weight1)

      result[0] = values[offset0] * (1 - ratio) + values[offset1] * ratio
    }

    return result
  }
}

export class AnimationBuilder {
  private _createTrack(node: string, TypedKeyframeTrack: typeof NumberKeyframeTrack | typeof QuaternionKeyframeTrack | typeof VectorKeyframeTrack, times: number[], values: number[], interpolations: number[]): InstanceType<typeof TypedKeyframeTrack> {
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

    const track = new TypedKeyframeTrack(node, times, values)

    // @ts-expect-error monkey patch
    track.createInterpolant = function InterpolantFactoryMethodCubicBezier(result) {
      return new CubicBezierInterpolation(this.times, this.values, this.getValueSize(), result, new Float32Array(interpolations))
    }

    return track
  }

  /**
   * @param {object} vmd - parsed VMD data
   * @param {SkinnedMesh} mesh - tracks will be fitting to mesh
   * @return {AnimationClip}
   */
  build(vmd: Vmd, mesh: SkinnedMesh): AnimationClip {
    // combine skeletal and morph animations

    const tracks = this.buildSkeletalAnimation(vmd, mesh).tracks
    const tracks2 = this.buildMorphAnimation(vmd, mesh).tracks

    for (let i = 0, il = tracks2.length; i < il; i++) {
      tracks.push(tracks2[i])
    }

    return new AnimationClip('', -1, tracks)
  }

  /**
   * @param {object} vmd - parsed VMD data
   * @return {AnimationClip}
   */
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
    const centers: number[] = []
    const quaternions: number[] = []
    const positions: number[] = []
    const fovs = []

    const cInterpolations: number[] = []
    const qInterpolations: number[] = []
    const pInterpolations: number[] = []
    const fInterpolations: number[] = []

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

  /**
   * @param {object} vmd - parsed VMD data
   * @param {SkinnedMesh} mesh - tracks will be fitting to mesh
   * @return {AnimationClip}
   */
  private buildMorphAnimation(vmd: Vmd, mesh: SkinnedMesh): AnimationClip {
    const tracks = []

    const morphs: Record<string, VmdMorphFrame[]> = {}
    const morphTargetDictionary = mesh.morphTargetDictionary!

    for (let i = 0; i < vmd.metadata.morphCount; i++) {
      const morph = vmd.morphs[i]
      const morphName = morph.morphName

      if (morphTargetDictionary[morphName] === undefined)
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

  /**
   * @param {object} vmd - parsed VMD data
   * @param {SkinnedMesh} mesh - tracks will be fitting to mesh
   * @return {AnimationClip}
   */
  private buildSkeletalAnimation(vmd: Vmd, mesh: SkinnedMesh) {
    const pushInterpolation = (array: number[], interpolation: number[], index: number) => {
      array.push(interpolation[index + 0] / 127) // x1
      array.push(interpolation[index + 8] / 127) // x2
      array.push(interpolation[index + 4] / 127) // y1
      array.push(interpolation[index + 12] / 127) // y2
    }

    const tracks = []

    type BoneName = string
    const motions: Record<BoneName, VmdMotionFrame[]> = {}
    const bones = mesh.skeleton.bones
    const boneNameDictionary: Record<BoneName, boolean> = {}

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

      const times: number[] = []
      const positions: number[] = []
      const rotations: number[] = []
      const pInterpolations: number[] = []
      const rInterpolations: number[] = []

      const basePosition = mesh.skeleton.getBoneByName(key)!.position.toArray()

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

// interpolation

/**
 * @param {import('three').LoadingManager} manager
 */
export class MeshBuilder {
  crossOrigin = 'anonymous'
  geometryBuilder: GeometryBuilder
  materialBuilder: MaterialBuilder
  constructor(manager: LoadingManager) {
    this.geometryBuilder = new GeometryBuilder()
    this.materialBuilder = new MaterialBuilder(manager)
  }

  /**
   * @param data - parsed PMD/PMX data
   * @param onProgress
   * @param onError
   * @return {SkinnedMesh}
   */
  build(data: Pmd | Pmx, resourcePath: string, onProgress: () => void, onError: () => void): SkinnedMesh {
    const geometry = this.geometryBuilder.build(data)
    const material = this.materialBuilder
      .setCrossOrigin(this.crossOrigin)
      .setResourcePath(resourcePath)
      .build(data, geometry, onProgress, onError)

    const mesh = new SkinnedMesh(geometry, material)

    const skeleton = new Skeleton(initBones(mesh))
    mesh.bind(skeleton)

    // console.log( mesh ); // for console debug

    return mesh
  }

  setCrossOrigin(crossOrigin: string): this {
    this.crossOrigin = crossOrigin
    return this
  }
}
