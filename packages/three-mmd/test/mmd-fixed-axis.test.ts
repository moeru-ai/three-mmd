import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Bone, BufferGeometry, MeshBasicMaterial, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { MMD } from '../src/utils/mmd'
import { postParseProcessing } from '../src/utils/post-parse'

interface BoneSpec {
  appendTransform?: NonNullable<PmxObject.Bone['appendTransform']>
  axisLimit?: [number, number, number]
  flag?: number
}

const createPmx = (specs: BoneSpec[]): PmxObject => ({
  bones: specs.map((spec, index) => ({
    appendTransform: spec.appendTransform,
    axisLimit: spec.axisLimit,
    englishName: `bone-${index}`,
    externalParentTransform: undefined,
    flag: spec.flag ?? 0,
    ik: undefined,
    localVector: undefined,
    name: `bone-${index}`,
    parentBoneIndex: -1,
    position: [0, 0, 0],
    tailPosition: [0, 0, 0],
    transformOrder: 0,
  })),
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
})

const createModel = (specs: BoneSpec[], convert = false) => {
  const bones = specs.map(() => new Bone())
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())
  mesh.add(...bones)
  mesh.bind(new Skeleton(bones))

  const pmx = createPmx(specs)
  if (convert)
    postParseProcessing(pmx)

  return { bones, mmd: new MMD(pmx, mesh) }
}

const aroundAxis = (x: number, y: number, z: number, angle: number) =>
  new Quaternion().setFromAxisAngle(new Vector3(x, y, z).normalize(), angle)

const expectSameRotation = (actual: Quaternion, expected: Quaternion) =>
  expect(actual.angleTo(expected)).toBeCloseTo(0, 5)

describe('pMX fixed axis bones', () => {
  it('keeps the angle of the animated rotation but rotates around the fixed axis', () => {
    const { bones, mmd } = createModel([{ axisLimit: [0, 0, 2] }])
    bones[0].quaternion.copy(aroundAxis(1, 0, 0, Math.PI / 2))

    mmd.update(0, { physics: false })

    expectSameRotation(bones[0].quaternion, aroundAxis(0, 0, 1, Math.PI / 2))
  })

  it('reverses the angle when the animated axis points against the fixed axis', () => {
    const { bones, mmd } = createModel([{ axisLimit: [0, 0, 1] }])
    bones[0].quaternion.copy(aroundAxis(0, 0.6, -0.8, Math.PI / 3))

    mmd.update(0, { physics: false })

    expectSameRotation(bones[0].quaternion, aroundAxis(0, 0, 1, -Math.PI / 3))
  })

  it('treats a quaternion and its negation as the same rotation', () => {
    const specs = [{ axisLimit: [0, 0, 1] as [number, number, number] }]
    const rotation = aroundAxis(1, 0, 0, Math.PI / 2)
    const first = createModel(specs)
    const second = createModel(specs)
    first.bones[0].quaternion.copy(rotation)
    second.bones[0].quaternion.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w)

    first.mmd.update(0, { physics: false })
    second.mmd.update(0, { physics: false })

    expectSameRotation(first.bones[0].quaternion, second.bones[0].quaternion)
  })

  it('removes the animated rotation when the axis is a zero vector', () => {
    const { bones, mmd } = createModel([{ axisLimit: [0, 0, 0] }])
    bones[0].quaternion.copy(aroundAxis(1, 0, 0, 1))

    mmd.update(0, { physics: false })

    expectSameRotation(bones[0].quaternion, new Quaternion())
  })

  it('leaves bones without a fixed axis alone', () => {
    const { bones, mmd } = createModel([{}])
    const rotation = aroundAxis(1, 2, 3, 0.7)
    bones[0].quaternion.copy(rotation)

    mmd.update(0, { physics: false })

    expectSameRotation(bones[0].quaternion, rotation)
  })

  it('is applied before append transforms read the rotation', () => {
    const { bones, mmd } = createModel([
      { axisLimit: [0, 0, 1] },
      {
        appendTransform: { parentIndex: 0, ratio: 1 },
        flag: PmxObject.Bone.Flag.HasAppendRotate,
      },
    ])
    bones[0].quaternion.copy(aroundAxis(1, 0, 0, Math.PI / 2))

    mmd.update(0, { physics: false })

    expectSameRotation(bones[1].quaternion, aroundAxis(0, 0, 1, Math.PI / 2))
  })

  it('is stable over repeated updates and picks up new input', () => {
    const { bones, mmd } = createModel([{ axisLimit: [0, 0, 1] }])
    bones[0].quaternion.copy(aroundAxis(1, 0, 0, 1))

    mmd.update(0, { physics: false })
    mmd.update(0, { physics: false })
    expectSameRotation(bones[0].quaternion, aroundAxis(0, 0, 1, 1))

    bones[0].quaternion.copy(aroundAxis(0, 1, 0, 0.5))
    mmd.update(0, { physics: false })
    expectSameRotation(bones[0].quaternion, aroundAxis(0, 0, 1, 0.5))
  })

  it('restores the animated rotation for the next mixer update', () => {
    const { bones, mmd } = createModel([{ axisLimit: [0, 0, 1] }])
    const animated = aroundAxis(1, 0, 0, 1)
    bones[0].quaternion.copy(animated)

    mmd.update(0, { physics: false })
    mmd.beforeUpdate()

    expectSameRotation(bones[0].quaternion, animated)
  })

  it('negates the axis in X and Y when converting to right-handed coordinates', () => {
    const pmx = createPmx([{ axisLimit: [1, 2, 3] }])

    postParseProcessing(pmx)

    expect(pmx.bones[0].axisLimit).toEqual([-1, -2, 3])
  })

  it('projects onto the converted axis', () => {
    const { bones, mmd } = createModel([{ axisLimit: [1, 0, 1] }], true)
    // Along the converted axis (-1, 0, 1) this is a positive turn; along the raw axis (1, 0, 1) it would be negative.
    bones[0].quaternion.copy(aroundAxis(-1, 0, 0, Math.PI / 2))

    mmd.update(0, { physics: false })

    expectSameRotation(bones[0].quaternion, aroundAxis(-1, 0, 1, Math.PI / 2))
  })
})
