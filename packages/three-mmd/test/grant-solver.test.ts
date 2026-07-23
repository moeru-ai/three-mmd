import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Bone, BufferGeometry, MeshBasicMaterial, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { GrantSolver } from '../src/physics/grant-solver'

interface BoneSpec {
  appendTransform?: { parentIndex: number, ratio: number }
  flag?: number
  parentBoneIndex?: number
  position?: [number, number, number]
  transformOrder?: number
}

const createPmx = (specs: BoneSpec[]): PmxObject => {
  const zero: [number, number, number] = [0, 0, 0]
  const bones: PmxObject['bones'] = specs.map((spec, index) => ({
    appendTransform: spec.appendTransform,
    axisLimit: undefined,
    englishName: `bone-${index}`,
    externalParentTransform: undefined,
    flag: spec.flag ?? 0,
    ik: undefined,
    localVector: undefined,
    name: `bone-${index}`,
    parentBoneIndex: spec.parentBoneIndex ?? -1,
    position: spec.position ?? [0, 0, 0],
    tailPosition: zero,
    transformOrder: spec.transformOrder ?? 0,
  }))

  return {
    bones,
    displayFrames: [],
    header: {
      additionalVec4Count: 0,
      boneIndexSize: 4,
      comment: '',
      encoding: PmxObject.Header.Encoding.Utf8,
      englishComment: '',
      englishModelName: '',
      materialIndexSize: 4,
      modelName: '',
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
}

const createMesh = (specs: BoneSpec[]) => {
  const bones = specs.map((spec, index) => {
    const bone = new Bone()
    bone.name = `bone-${index}`
    bone.position.fromArray(spec.position ?? [0, 0, 0])
    return bone
  })

  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())
  specs.forEach((spec, index) => {
    const parentIndex = spec.parentBoneIndex ?? -1
    if (parentIndex >= 0)
      bones[parentIndex].add(bones[index])
    else
      mesh.add(bones[index])
  })

  mesh.bind(new Skeleton(bones))
  mesh.updateMatrixWorld(true)
  return { bones, mesh }
}

const solve = (specs: BoneSpec[], setup?: (bones: Bone[]) => void) => {
  const { bones, mesh } = createMesh(specs)
  const solver = new GrantSolver(mesh, createPmx(specs))
  setup?.(bones)
  mesh.updateMatrixWorld(true)
  solver.update()
  return { bones, mesh }
}

const closeTo = (actual: number, expected: number) =>
  expect(actual).toBeCloseTo(expected, 5)

describe('grantSolver', () => {
  const rotateFlag = PmxObject.Bone.Flag.HasAppendRotate
  const moveFlag = PmxObject.Bone.Flag.HasAppendMove
  const localFlag = PmxObject.Bone.Flag.LocalAppendTransform

  it('applies a global rotation with a positive ratio', () => {
    const { bones } = solve([
      {},
      { appendTransform: { parentIndex: 0, ratio: 0.5 }, flag: rotateFlag },
    ], (bones) => {
      bones[0].quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    })

    closeTo(bones[1].quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)), 0)
  })

  it('applies a global position offset and supports negative ratios', () => {
    const { bones } = solve([
      { position: [2, 0, 0] },
      { appendTransform: { parentIndex: 0, ratio: -0.5 }, flag: moveFlag, position: [4, 0, 0] },
    ], (bones) => {
      bones[0].position.x = 5
    })

    closeTo(bones[1].position.x, 2.5)
  })

  it('applies local rotation from the source world transform', () => {
    const { bones } = solve([
      {},
      { parentBoneIndex: 0 },
      { appendTransform: { parentIndex: 1, ratio: 1 }, flag: rotateFlag | localFlag },
    ], (bones) => {
      bones[0].quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
    })

    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
    closeTo(bones[2].quaternion.angleTo(expected), 0)
  })

  it('applies local position from the source skin transform', () => {
    const { bones } = solve([
      { position: [2, 0, 0] },
      { appendTransform: { parentIndex: 0, ratio: 1 }, flag: moveFlag | localFlag, position: [4, 0, 0] },
    ], (bones) => {
      bones[0].position.x = 5
    })

    closeTo(bones[1].position.x, 7)
  })

  it('propagates the solved append result through a global append chain', () => {
    const { bones } = solve([
      {},
      { appendTransform: { parentIndex: 0, ratio: 0.5 }, flag: rotateFlag, transformOrder: 1 },
      { appendTransform: { parentIndex: 1, ratio: 1 }, flag: rotateFlag, transformOrder: 2 },
    ], (bones) => {
      bones[0].quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    })

    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)
    closeTo(bones[1].quaternion.angleTo(expected), 0)
    closeTo(bones[2].quaternion.angleTo(expected), 0)
  })

  it('processes append targets in stable transform order', () => {
    const { bones } = solve([
      {},
      { appendTransform: { parentIndex: 0, ratio: 1 }, flag: rotateFlag, transformOrder: 2 },
      { appendTransform: { parentIndex: 1, ratio: 1 }, flag: rotateFlag, transformOrder: 1 },
    ], (bones) => {
      bones[0].quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    })

    closeTo(bones[1].quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)), 0)
    closeTo(bones[2].quaternion.angleTo(new Quaternion()), 0)
  })

  it('does not accumulate when update is called twice without a new animation pose', () => {
    const specs = [
      {},
      { appendTransform: { parentIndex: 0, ratio: 0.5 }, flag: rotateFlag },
    ]
    const { bones, mesh } = createMesh(specs)
    bones[0].quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    mesh.updateMatrixWorld(true)
    const solver = new GrantSolver(mesh, createPmx(specs))

    solver.update()
    solver.update()

    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4)
    closeTo(bones[1].quaternion.angleTo(expected), 0)
  })

  it('rejects an invalid append source index', () => {
    const specs = [
      {},
      { appendTransform: { parentIndex: 2, ratio: 1 }, flag: rotateFlag },
    ]
    const { mesh } = createMesh(specs)

    expect(() => new GrantSolver(mesh, createPmx(specs))).toThrow(/invalid append source index 2/)
  })
})
