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

type IkMetadata = NonNullable<PmxObject['bones'][number]['ik']>

const createBoneMetadata = (
  name: string,
  parentBoneIndex = -1,
  position: [number, number, number] = [0, 0, 0],
  ik?: IkMetadata,
) => ({
  appendTransform: undefined,
  axisLimit: undefined,
  englishName: name,
  externalParentTransform: undefined,
  flag: ik === undefined ? 0 : PmxObject.Bone.Flag.IsIkEnabled,
  ik,
  localVector: undefined,
  name,
  parentBoneIndex,
  position,
  tailPosition: [0, 0, 0] as [number, number, number],
  transformOrder: 0,
})

const createIkMmd = (ikNameOrNames: string | string[] = 'ik') => {
  const ikNames = typeof ikNameOrNames === 'string' ? [ikNameOrNames] : ikNameOrNames
  const bones: Bone[] = []
  const pmxBones: PmxObject['bones'][number][] = []
  const mesh = new ThreeSkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())

  ikNames.forEach((ikName, index) => {
    const suffix = index === 0 ? '' : `-${index}`
    const linkName = `link${suffix}`
    const targetName = `target${suffix}`
    const ikBone = new Bone()
    const linkBone = new Bone()
    const targetBone = new Bone()
    ikBone.name = ikName
    linkBone.name = linkName
    targetBone.name = targetName
    linkBone.add(targetBone)
    mesh.add(ikBone, linkBone)
    bones.push(ikBone, linkBone, targetBone)

    const boneIndex = index * 3
    pmxBones.push(
      createBoneMetadata(ikName, -1, [0, 0, 0], {
        iteration: 1,
        links: [{ limitation: undefined, target: boneIndex + 1 }],
        rotationConstraint: Math.PI,
        target: boneIndex + 2,
      }),
      createBoneMetadata(linkName),
      createBoneMetadata(targetName, boneIndex + 1, [1, 0, 0]),
    )
  })

  mesh.bind(new Skeleton(bones))

  const pmx: PmxObject = {
    bones: pmxBones,
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
    expect(clip.duration).toBeCloseTo(31 / 30)
    expect((clip.clone().userData as MMDAnimationUserData).propertyTrack).toEqual(propertyTrack)
  })

  it('keeps a frame-zero property-only clip playable', () => {
    const clip = buildAnimation(createVmd([
      { frameNumber: 0, ikStates: [['ik', true]], visible: true },
    ]), mesh)

    expect(clip.duration).toBeCloseTo(1 / 30)
  })

  it('keeps the final property key active before the default loop wraps', () => {
    const clip = buildAnimation(createVmd([
      { frameNumber: 0, ikStates: [['ik', true]], visible: true },
      { frameNumber: 30, ikStates: [['ik', false]], visible: true },
    ]), mesh)
    const mmd = createIkMmd()
    const mixer = new AnimationMixer(mmd.mesh)
    mixer.clipAction(clip).play()

    mmd.updateWithMixer(1, mixer, { grant: false, physics: false })

    expect(mmd.ikSolver.isEnabled(0)).toBe(false)
    expect(clip.duration).toBeCloseTo(31 / 30)
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
    expect(setEnabled).toHaveBeenLastCalledWith(0, false)
    expect(mmd.ikSolver.isEnabled(0)).toBe(false)
  })

  it('restores animation-controlled IK when the active property action stops', () => {
    const mmd = createIkMmd()
    const propertyClip = new AnimationClip('property', 1, [])
    propertyClip.userData = {
      propertyTrack: {
        frameNumbers: [0],
        ikBoneNames: ['ik'],
        ikStates: [[false]],
      },
    }
    const mixer = new AnimationMixer(mmd.mesh)
    const propertyAction = mixer.clipAction(propertyClip).play()

    mmd.updateWithMixer(0, mixer, { grant: false, physics: false })
    expect(mmd.ikSolver.isEnabled(0)).toBe(false)

    propertyAction.stop()
    mixer.clipAction(new AnimationClip('plain', 1, [])).play()
    mmd.updateWithMixer(0, mixer, { grant: false, physics: false })

    expect(mmd.ikSolver.isEnabled(0)).toBe(true)
  })

  it('restores the IK state that existed before animation took control', () => {
    const mmd = createIkMmd()
    mmd.ikSolver.setEnabled(0, false)

    const propertyClip = new AnimationClip('property', 1, [])
    propertyClip.userData = {
      propertyTrack: {
        frameNumbers: [0],
        ikBoneNames: ['ik'],
        ikStates: [[true]],
      },
    }
    const mixer = new AnimationMixer(mmd.mesh)
    const propertyAction = mixer.clipAction(propertyClip).play()

    mmd.updateWithMixer(0, mixer, { grant: false, physics: false })
    expect(mmd.ikSolver.isEnabled(0)).toBe(true)

    propertyAction.stop()
    mixer.clipAction(new AnimationClip('plain', 1, [])).play()
    mmd.updateWithMixer(0, mixer, { grant: false, physics: false })

    expect(mmd.ikSolver.isEnabled(0)).toBe(false)
  })

  it('applies property states from multiple actions per IK bone', () => {
    const mmd = createIkMmd(['left', 'right'])
    const leftClip = new AnimationClip('left-property', 1, [])
    leftClip.userData = {
      propertyTrack: {
        frameNumbers: [0],
        ikBoneNames: ['left'],
        ikStates: [[false]],
      },
    }
    const rightClip = new AnimationClip('right-property', 1, [])
    rightClip.userData = {
      propertyTrack: {
        frameNumbers: [0],
        ikBoneNames: ['right'],
        ikStates: [[false]],
      },
    }
    const manager = new MMDAnimationManager()
    manager.add(mmd, { animation: [leftClip, rightClip] })

    manager.update(0, { grant: false, physics: false })

    expect(mmd.ikSolver.isEnabled(0)).toBe(false)
    expect(mmd.ikSolver.isEnabled(3)).toBe(false)
  })

  it('restores animation-controlled IK when an animation manager removes the MMD', () => {
    const mmd = createIkMmd()
    const clip = new AnimationClip('property', 1, [])
    clip.userData = {
      propertyTrack: {
        frameNumbers: [0],
        ikBoneNames: ['ik'],
        ikStates: [[false]],
      },
    }
    const manager = new MMDAnimationManager()
    manager.add(mmd, { animation: clip })

    manager.update(0, { grant: false, physics: false })
    expect(mmd.ikSolver.isEnabled(0)).toBe(false)

    manager.remove(mmd)

    expect(mmd.ikSolver.isEnabled(0)).toBe(true)
  })

  it('does not apply an IK property state before its first key', () => {
    const mmd = createIkMmd()
    const clip = new AnimationClip('property', 1, [])
    clip.userData = {
      propertyTrack: {
        frameNumbers: [30],
        ikBoneNames: ['ik'],
        ikStates: [[false]],
      },
    }
    const mixer = new AnimationMixer(mmd.mesh)
    mixer.clipAction(clip).play()

    mmd.updateWithMixer(0, mixer, { grant: false, physics: false })

    expect(mmd.ikSolver.isEnabled(0)).toBe(true)
  })

  it.each([
    ['左足ＩＫ', '左足IK'],
    ['左足IK', '左足ＩＫ'],
  ])('matches IK property names after NFKC normalization (%s model, %s VMD)', (modelIkName, vmdIkName) => {
    const mmd = createIkMmd(modelIkName)
    const clip = new AnimationClip('property', 1, [])
    clip.userData = {
      propertyTrack: {
        frameNumbers: [0, 15],
        ikBoneNames: [vmdIkName],
        ikStates: [[true, false]],
      },
    }
    const setEnabled = vi.spyOn(mmd.ikSolver, 'setEnabled')
    const mixer = new AnimationMixer(mmd.mesh)
    mixer.clipAction(clip).play()

    mmd.updateWithMixer(0.5, mixer, { grant: false, physics: false })

    expect(setEnabled).toHaveBeenCalledWith(0, false)
    expect(mmd.ikSolver.isEnabled(0)).toBe(false)
  })
})
