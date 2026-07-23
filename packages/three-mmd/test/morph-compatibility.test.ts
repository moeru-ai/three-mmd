import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { VmdObject } from 'babylon-mmd/esm/Loader/Parser/vmdObject'
import {
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh,
} from 'three'
import { describe, expect, it, vi } from 'vitest'

import { buildAnimation } from '../src/utils/build-animation'
import { buildGeometry } from '../src/utils/build-geometry'

const morphBase = (name: string) => ({
  category: PmxObject.Morph.Category.Other,
  englishName: name,
  name,
})

const boneMorph = (name: string): PmxObject.Morph.BoneMorph => ({
  ...morphBase(name),
  indices: new Int32Array(),
  positions: new Float32Array(),
  rotations: new Float32Array(),
  type: PmxObject.Morph.Type.BoneMorph,
})

const groupMorph = (
  name: string,
  indices: number[],
  ratios: number[],
): PmxObject.Morph.GroupMorph => ({
  ...morphBase(name),
  indices: Int32Array.from(indices),
  ratios: Float32Array.from(ratios),
  type: PmxObject.Morph.Type.GroupMorph,
})

const materialMorph = (name: string): PmxObject.Morph.MaterialMorph => ({
  ...morphBase(name),
  elements: [],
  type: PmxObject.Morph.Type.MaterialMorph,
})

const uvMorph = (name: string): PmxObject.Morph.UvMorph => ({
  ...morphBase(name),
  indices: new Int32Array(),
  offsets: new Float32Array(),
  type: PmxObject.Morph.Type.UvMorph,
})

const vertexMorph = (
  name: string,
  offset: [number, number, number],
): PmxObject.Morph.VertexMorph => ({
  ...morphBase(name),
  indices: Int32Array.of(0),
  positions: Float32Array.from(offset),
  type: PmxObject.Morph.Type.VertexMorph,
})

const createPmx = (morphs: PmxObject.Morph[]): PmxObject => ({
  bones: [],
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
  morphs,
  rigidBodies: [],
  softBodies: [],
  textures: [],
  vertices: [{
    additionalVec4: [],
    boneWeight: {
      boneIndices: 0,
      boneWeights: null,
    },
    edgeScale: 1,
    normal: [0, 1, 0],
    position: [1, 2, 3],
    uv: [0, 0],
    weightType: PmxObject.Vertex.BoneWeightType.Bdef1,
  }],
})

const createVmd = (morphNames: string[]): VmdObject => {
  const frameBytes = 15 + 4 + 4
  const buffer = new ArrayBuffer(30 + 20 + 4 + 4 + morphNames.length * frameBytes)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const encoder = new TextEncoder()

  bytes.set(encoder.encode('Vocaloid Motion Data 0002'), 0)

  let offset = 30 + 20
  view.setUint32(offset, 0, true)
  offset += 4
  view.setUint32(offset, morphNames.length, true)
  offset += 4

  morphNames.forEach((name, index) => {
    bytes.set(encoder.encode(name).subarray(0, 15), offset)
    offset += 15
    view.setUint32(offset, index, true)
    offset += 4
    view.setFloat32(offset, (index + 1) / 10, true)
    offset += 4
  })

  return VmdObject.ParseFromBuffer(buffer)
}

describe('three-stdlib morph compatibility', () => {
  const morphs: PmxObject.Morph[] = [
    boneMorph('bone'),
    vertexMorph('vertex', [2, 0, 0]),
    materialMorph('material'),
    groupMorph('group', [1, 0, 2], [0.5, 1, 1]),
    uvMorph('uv'),
    groupMorph('negative', [1], [-0.5]),
    groupMorph('large', [1], [2]),
  ]

  it('keeps every PMX morph in source order with absolute position targets', () => {
    const geometry = buildGeometry(createPmx(morphs))
    const targets = geometry.morphAttributes.position

    expect(geometry.morphTargetsRelative).toBe(false)
    expect(targets?.map(target => target.name)).toEqual(morphs.map(morph => morph.name))
    expect(targets?.map(target => Array.from(target.array))).toEqual([
      [1, 2, 3],
      [3, 2, 3],
      [1, 2, 3],
      [2, 2, 3],
      [1, 2, 3],
      [0, 2, 3],
      [5, 2, 3],
    ])
  })

  it('uses PMX source indices in the Three.js morph dictionary', () => {
    const mesh = new SkinnedMesh(
      buildGeometry(createPmx(morphs)),
      new MeshBasicMaterial(),
    )

    expect(mesh.morphTargetDictionary).toEqual({
      bone: 0,
      group: 3,
      large: 6,
      material: 2,
      negative: 5,
      uv: 4,
      vertex: 1,
    })
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('keeps VMD tracks for unsupported morph types', () => {
    const mesh = new SkinnedMesh(
      buildGeometry(createPmx(morphs)),
      new MeshBasicMaterial(),
    )
    mesh.bind(new Skeleton([]))

    const clip = buildAnimation(
      createVmd(morphs.map(morph => morph.name)),
      mesh,
    )

    expect(clip.tracks.map(track => track.name)).toEqual(
      morphs.map((_, index) => `.morphTargetInfluences[${index}]`),
    )
  })

  it('warns and skips invalid or nested group references', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const malformedMorphs: PmxObject.Morph[] = [
      groupMorph('root', [99, 1], [1, 1]),
      groupMorph('nested', [], []),
    ]

    expect(() => buildGeometry(createPmx(malformedMorphs))).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenNthCalledWith(
      1,
      'buildGeometry: Group morph "root" references invalid morph index 99; skipping.',
    )
    expect(warn).toHaveBeenNthCalledWith(
      2,
      'buildGeometry: Group morph "root" references group morph index 1; skipping unsupported nesting.',
    )

    warn.mockRestore()
  })
})
