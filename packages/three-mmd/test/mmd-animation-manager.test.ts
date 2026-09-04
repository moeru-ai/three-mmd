import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  AnimationClip,
  Bone,
  BufferGeometry,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  PerspectiveCamera,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MMD, MMDAnimationManager } from '../src'

const createMmd = (name: string) => {
  const bone = new Bone()
  bone.name = name

  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())
  mesh.add(bone)
  mesh.bind(new Skeleton([bone]))

  const pmx: PmxObject = {
    bones: [{
      appendTransform: undefined,
      axisLimit: undefined,
      englishName: name,
      externalParentTransform: undefined,
      flag: 0,
      ik: undefined,
      localVector: undefined,
      name,
      parentBoneIndex: -1,
      position: [0, 0, 0],
      tailPosition: [0, 0, 0],
      transformOrder: 0,
    }],
    displayFrames: [],
    header: {
      additionalVec4Count: 0,
      boneIndexSize: 4,
      comment: '',
      encoding: PmxObject.Header.Encoding.Utf8,
      englishComment: '',
      englishModelName: '',
      materialIndexSize: 4,
      modelName: name,
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

const createClip = (name: string) =>
  new AnimationClip(name, 1, [new VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0])])

const createCameraClip = () =>
  new AnimationClip('camera animation', 1, [
    new VectorKeyframeTrack('target.position', [0, 1], [0, 0, -1, 1, 2, -3]),
    new NumberKeyframeTrack('.fov', [0, 1], [30, 60]),
  ])

describe('mMDAnimationManager', () => {
  it('advances every registered MMD through its mixer and MMD update', () => {
    const first = createMmd('first')
    const second = createMmd('second')
    const firstPhysicsUpdate = vi.fn()
    const secondPhysicsUpdate = vi.fn()
    const firstPhysics = {
      createHelper: <T>() => undefined as T,
      update: firstPhysicsUpdate,
    }
    const secondPhysics = {
      createHelper: <T>() => undefined as T,
      update: secondPhysicsUpdate,
    }
    first.setPhysics(() => firstPhysics)
    second.setPhysics(() => secondPhysics)
    const manager = new MMDAnimationManager()

    manager.add(first, { animation: createClip('first animation') })
    manager.add(second, { animation: createClip('second animation') })
    manager.update(0.25)

    expect(first.mesh.position.x).toBeCloseTo(0.25)
    expect(second.mesh.position.x).toBeCloseTo(0.25)
    expect(firstPhysicsUpdate).toHaveBeenCalledOnce()
    expect(firstPhysicsUpdate).toHaveBeenCalledWith(0.25)
    expect(secondPhysicsUpdate).toHaveBeenCalledOnce()
    expect(secondPhysicsUpdate).toHaveBeenCalledWith(0.25)
  })

  it('passes MMD update options to every registered model', () => {
    const mmd = createMmd('options')
    const physicsUpdate = vi.fn()
    const physics = {
      createHelper: <T>() => undefined as T,
      update: physicsUpdate,
    }
    mmd.setPhysics(() => physics)
    const manager = new MMDAnimationManager()

    manager.add(mmd)
    manager.update(0.25, { physics: false })
    expect(physicsUpdate).not.toHaveBeenCalled()

    manager.update(0.25)
    expect(physicsUpdate).toHaveBeenCalledOnce()
    expect(physicsUpdate).toHaveBeenCalledWith(0.25)
  })

  it('updates the registered MMD camera and its target after animation', () => {
    const camera = new PerspectiveCamera(30, 1, 0.1, 100)
    const manager = new MMDAnimationManager()

    manager.add(camera, { animation: createCameraClip() })
    manager.update(0.5)

    expect(camera.fov).toBe(45)
    expect(camera.children).toHaveLength(1)
    expect(camera.children[0]).toMatchObject({ name: 'target' })
    expect(camera.children[0].position.toArray()).toEqual([0.5, 1, -2])
    const direction = camera.getWorldDirection(new Vector3())
    expect(direction.x).toBeCloseTo(0.21821789, 6)
    expect(direction.y).toBeCloseTo(0.43643578, 6)
    expect(direction.z).toBeCloseTo(-0.87287156, 6)
  })

  it('starts delayed audio once and stops audio it started when removed', () => {
    let playing = false
    const play = vi.fn(() => {
      playing = true
    })
    const stop = vi.fn(() => {
      playing = false
    })
    const audio = {
      get isPlaying() {
        return playing
      },
      play,
      stop,
      type: 'Audio',
    } as unknown as import('three').Audio
    const manager = new MMDAnimationManager()

    manager.add(audio, { delayTime: 1 })
    manager.update(0.5)
    expect(play).not.toHaveBeenCalled()

    manager.update(0.5)
    manager.update(1)
    expect(play).toHaveBeenCalledOnce()

    manager.remove(audio)
    expect(stop).toHaveBeenCalledOnce()
  })

  it('removes one model without affecting other registered objects', () => {
    const first = createMmd('first')
    const second = createMmd('second')
    const camera = new PerspectiveCamera()
    const manager = new MMDAnimationManager()

    manager.add(first)
    manager.add(second, { animation: createClip('second animation') })
    manager.add(camera)
    manager.remove(first)
    second.mesh.position.x = 0
    manager.update(0.25)

    expect(first.mesh.position.x).toBe(0)
    expect(second.mesh.position.x).toBeCloseTo(0.25)

    manager.dispose()
    expect(camera.children).toHaveLength(0)
  })
})
