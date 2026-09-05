import type { VmdObject } from 'babylon-mmd/esm/Loader/Parser/vmdObject'
import type { SkinnedMesh } from 'three'

import type { MMDAnimationUserData } from '../src/utils/build-animation'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh as ThreeSkinnedMesh,
} from 'three'
import { describe, expect, it, vi } from 'vitest'

import { buildAnimation } from '../src/utils/build-animation'
import { MMD } from '../src/utils/mmd'
import { MMDAnimationManager } from '../src/utils/mmd-animation-manager'

// eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
const createVmd = (propertyKeyFrames: VmdObject.PropertyKeyFrame[]) => ({
  boneKeyFrames: { length: 0 },
  cameraKeyFrames: { length: 0 },
  morphKeyFrames: { length: 0 },
  propertyKeyFrames,
}) as unknown as VmdObject

// eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
const mesh = {
  morphTargetDictionary: {},
  skeleton: {
    bones: [],
    getBoneByName: () => undefined,
  },
} as unknown as SkinnedMesh

const createIkMmd = () => {
  const bones = ['ik', 'link', 'target'].map((name) => {
    const bone = new Bone()
    bone.name = name
    return bone
  })
  bones[1].add(bones[2])

  const mesh = new ThreeSkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())
  mesh.add(bones[0], bones[1])
  mesh.bind(new Skeleton(bones))

  const pmx: PmxObject = {
    bones: [
      {
        appendTransform: undefined,
        axisLimit: undefined,
        englishName: 'ik',
        externalParentTransform: undefined,
        flag: PmxObject.Bone.Flag.IsIkEnabled,
        ik: {
          iteration: 1,
          links: [{ limitation: undefined, target: 1 }],
          rotationConstraint: Math.PI,
          target: 2,
        },
        localVector: undefined,
        name: 'ik',
        parentBoneIndex: -1,
        position: [0, 0, 0],
        tailPosition: [0, 0, 0],
        transformOrder: 0,
      },
      {
        appendTransform: undefined,
        axisLimit: undefined,
        englishName: 'link',
        externalParentTransform: undefined,
        flag: 0,
        ik: undefined,
        localVector: undefined,
        name: 'link',
        parentBoneIndex: -1,
        position: [0, 0, 0],
        tailPosition: [0, 0, 0],
        transformOrder: 0,
      },
      {
        appendTransform: undefined,
        axisLimit: undefined,
        englishName: 'target',
        externalParentTransform: undefined,
        flag: 0,
        ik: undefined,
        localVector: undefined,
        name: 'target',
        parentBoneIndex: 1,
        position: [1, 0, 0],
        tailPosition: [0, 0, 0],
        transformOrder: 0,
      },
    ],
    displayFrames: [],
    header: {
      additionalVec4Count: 0,
      boneIndexSize: 4,
      comment: '',
      encoding: PmxObject.Header.Encoding.Utf8,
      englishComment: '',
      englishModelName: '',
      materialIndexSize: 4,
      modelName: 'property',
      morphIndexSize: 4,
      rigidBodyIndexSize: 4,
      signature: 'PMX',
      textureIndexSize: 4,
      version: 2,
      vertexIndexSize: 4,
    },
    indices: new Uint8Array(),
    joints: [],
    materials: [],
    morphs: [],
    rigidBodies: [],
    softBodies: [],
    textures: [],
    vertices: [],
  }

  return new MMD(pmx, mesh)
}

describe('mmd property animation', () => {
  it('stores a normalized IK property track in AnimationClip userData', () => {
    const clip = buildAnimation(createVmd([
      { frameNumber: 30, ikStates: [['right', false]], visible: true },
      { frameNumber: 15, ikStates: [['left', false]], visible: true },
      { frameNumber: 0, ikStates: [['left', true], ['right', true]], visible: true },
      { frameNumber: 15, ikStates: [['left', true]], visible: true },
    ]), mesh)

    const propertyTrack = (clip.userData as MMDAnimationUserData).propertyTrack
    expect(propertyTrack).toEqual({
      frameNumbers: [0, 15, 30],
      ikBoneNames: ['left', 'right'],
      ikStates: [[true, true, true], [true, true, false]],
    })
    expect(clip.duration).toBe(1)
    expect((clip.clone().userData as MMDAnimationUserData).propertyTrack).toEqual(propertyTrack)
  })

  it('keeps a frame-zero property-only clip playable', () => {
    const clip = buildAnimation(createVmd([
      { frameNumber: 0, ikStates: [['ik', true]], visible: true },
    ]), mesh)

    expect(clip.duration).toBeCloseTo(1 / 30)
  })

  it.each(['mixer', 'manager'])('applies the active property track before MMD IK evaluation through %s', (mode) => {
    const mmd = createIkMmd()
    const clip = new AnimationClip('property', 1, [])
    clip.userData = {
      propertyTrack: {
        frameNumbers: [0, 15],
        ikBoneNames: ['ik'],
        ikStates: [[true, false]],
      },
    }
    const setEnabled = vi.spyOn(mmd.ikSolver, 'setEnabled')
    let update: (delta: number) => void

    if (mode === 'mixer') {
      const mixer = new AnimationMixer(mmd.mesh)
      mixer.clipAction(clip).play()
      update = delta => mmd.updateWithMixer(delta, mixer, { grant: false, physics: false })
    }
    else {
      const manager = new MMDAnimationManager()
      manager.add(mmd, { animation: clip })
      update = delta => manager.update(delta, { grant: false, physics: false })
    }

    update(0.5)
    expect(setEnabled).toHaveBeenCalledWith(0, false)
    expect(mmd.ikSolver.isEnabled(0)).toBe(false)

    update(0.1)
    expect(setEnabled).toHaveBeenCalledOnce()
  })
})
