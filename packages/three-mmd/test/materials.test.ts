import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { MeshDepthMaterial, MeshDistanceMaterial } from 'three'

import type { MMDMaterialDescriptor } from '../src/materials/types'

import { Bone, BufferGeometry, Color, Float32BufferAttribute, ShaderLib, Skeleton, SkinnedMesh, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MMDMaterialPlugin } from '../src/loaders/loader-plugin'
import { applyMMDMaterialMorph, createMMDMaterialEvaluatedState } from '../src/materials/morph'
import { installMMDMaterialBindings } from '../src/materials/toon/bindings'
import { MMDToonMaterial } from '../src/materials/toon/mmd-toon-material'
import { buildGeometry } from '../src/utils/build-geometry'

const descriptor = (outline = { alpha: 1, color: new Color(0.1, 0.1, 0.1), visible: true, width: 0.01 }): MMDMaterialDescriptor => ({
  ambient: new Color(0.1, 0.2, 0.3),
  diffuse: new Color(0.4, 0.5, 0.6),
  fog: true,
  isDefaultToonTexture: true,
  name: 'test material',
  opacity: 1,
  outline,
  shininess: 16,
  specular: new Color(0.2, 0.3, 0.4),
  sphereBlendMode: 'multiply',
  sphereMap: new Texture(),
  toonMap: new Texture(),
  toonMapFileName: 'toon01.bmp',
  transparent: false,
})

const skinnedMesh = (materials: MMDToonMaterial[]): SkinnedMesh => {
  const mesh = new SkinnedMesh(new BufferGeometry(), materials)
  const bone = new Bone()
  mesh.add(bone)
  mesh.bind(new Skeleton([bone]))
  return mesh
}

describe('mmd material backends', () => {
  it('exposes the current material capabilities', () => {
    const toon = new MMDToonMaterial(descriptor())

    expect(toon.isMeshPhongMaterial).toBe(true)
    expect(toon.mmdCapabilities.sdef).toBe('full')
  })

  it('does not pass undefined parameters to Three material constructors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const material = new MMDToonMaterial(descriptor())

    expect(material).toBeInstanceOf(MMDToonMaterial)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('clones with its descriptor and keeps copy metadata synchronized', () => {
    const source = new MMDToonMaterial(descriptor())
    const target = new MMDToonMaterial(descriptor({ alpha: 1, color: new Color(), visible: false, width: 0 }))

    const clone = source.clone()
    target.copy(source)

    expect(clone).not.toBe(source)
    expect(clone.descriptor).toBe(source.descriptor)
    expect(target.descriptor).toBe(source.descriptor)
  })

  it('selects a material class through MMDMaterialPlugin', () => {
    const plugin = new MMDMaterialPlugin({ manager: {} as never, resourcePath: '' }, { materialType: MMDToonMaterial })
    expect(plugin.name).toBe('MMDMaterialPlugin')
    expect(plugin.materialType).toBe(MMDToonMaterial)
  })

  it('uses Three gradient-map coordinates for the PMX toon ramp', () => {
    const material = new MMDToonMaterial(descriptor())
    const shader = {
      fragmentShader: ShaderLib.phong.fragmentShader,
      uniforms: {},
      vertexShader: ShaderLib.phong.vertexShader,
    }

    material.onBeforeCompile(shader as never, {} as never)

    expect(shader.fragmentShader).toContain('dotNL * 0.5 + 0.5')
    expect(shader.fragmentShader).toContain('irradiance * BRDF_BlinnPhong')
    expect(shader.fragmentShader).not.toContain('#include <lights_fragment_maps>')
    expect(shader.fragmentShader).not.toContain('#include <envmap_fragment>')
  })

  it('evaluates multiply and additive material morph values without mutating the descriptor', () => {
    const state = createMMDMaterialEvaluatedState(descriptor())
    const multiply = {
      ambient: [2, 2, 2],
      diffuse: [2, 2, 2, 0.5],
      edgeColor: [1, 1, 1, 1],
      edgeSize: 1,
      shininess: 2,
      specular: [2, 2, 2],
      sphereTextureColor: [1, 1, 1, 1],
      textureColor: [1, 1, 1, 1],
      toonTextureColor: [1, 1, 1, 1],
      type: 0,
    } as unknown as PmxObject.Morph.MaterialMorph['elements'][number]
    const add = {
      ambient: [0, 0, 0],
      diffuse: [0.1, 0.2, 0.3, -0.25],
      edgeColor: [0, 0, 0, 0],
      edgeSize: 0,
      shininess: 0,
      specular: [0, 0, 0],
      sphereTextureColor: [0, 0, 0, 0],
      textureColor: [0.1, 0, 0, 0],
      toonTextureColor: [0, 0, 0, 0],
      type: 1,
    } as unknown as PmxObject.Morph.MaterialMorph['elements'][number]

    applyMMDMaterialMorph(state, multiply, 0.5)
    applyMMDMaterialMorph(state, add, 1)

    expect(state.diffuse.toArray()).toEqual(expect.arrayContaining([expect.closeTo(0.7), 0.95, 1.2]))
    expect(state.opacity).toBeCloseTo(0.5)
    expect(state.textureAdditiveColor.x).toBeCloseTo(0.1)
  })
})

describe('mmd toon bindings', () => {
  it('does not enable an edge-disabled outline after a material morph', () => {
    const disabled = new MMDToonMaterial(descriptor({ alpha: 1, color: new Color(), visible: false, width: 1 }))
    const enabled = new MMDToonMaterial(descriptor({ alpha: 1, color: new Color(), visible: true, width: 0 }))
    const mesh = skinnedMesh([disabled, enabled])
    installMMDMaterialBindings(mesh)
    const outline = mesh.children.find(child => child.name.endsWith(':mmd-outline')) as SkinnedMesh
    const outlineMaterials = Array.isArray(outline.material) ? outline.material : [outline.material]
    const state = createMMDMaterialEvaluatedState(disabled.descriptor)
    state.edgeWidth = 1

    disabled.applyMMDMaterialState(state)

    expect(outlineMaterials[0].visible).toBe(false)
    expect(outline.visible).toBe(false)
  })

  it('creates an initially hidden enabled outline that a material morph can reveal', () => {
    const material = new MMDToonMaterial(descriptor({ alpha: 1, color: new Color(), visible: true, width: 0 }))
    const mesh = skinnedMesh([material])
    installMMDMaterialBindings(mesh)
    const outline = mesh.children.find(child => child.name.endsWith(':mmd-outline')) as SkinnedMesh
    const state = createMMDMaterialEvaluatedState(material.descriptor)
    state.edgeWidth = 1

    expect(outline.visible).toBe(false)
    material.applyMMDMaterialState(state)

    expect(outline.visible).toBe(true)
  })

  it('installs custom SDEF shadows only when the mesh has SDEF vertices', () => {
    const material = new MMDToonMaterial(descriptor())
    const mesh = skinnedMesh([material])
    mesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([0], 1))

    installMMDMaterialBindings(mesh)

    expect(mesh.customDepthMaterial).toBeUndefined()
    expect(mesh.customDistanceMaterial).toBeUndefined()

    const sdefMesh = skinnedMesh([new MMDToonMaterial(descriptor())])
    sdefMesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))
    installMMDMaterialBindings(sdefMesh)

    expect(sdefMesh.customDepthMaterial).toBeDefined()
    expect(sdefMesh.customDistanceMaterial).toBeDefined()
  })

  it('selects a distinct shadow program variant for each material group', () => {
    const first = new MMDToonMaterial({ ...descriptor(), alphaTest: 0.3, map: new Texture() })
    const second = new MMDToonMaterial({ ...descriptor(), alphaTest: 0.8, map: new Texture() })
    const mesh = skinnedMesh([first, second])
    mesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))
    installMMDMaterialBindings(mesh)

    const depth = mesh.customDepthMaterial as MeshDepthMaterial
    const distance = mesh.customDistanceMaterial as MeshDistanceMaterial
    const initialDepthVersion = depth.version
    const initialDistanceVersion = distance.version

    mesh.onBeforeShadow({} as never, {} as never, {} as never, {} as never, mesh.geometry, depth, { materialIndex: 0 } as never)
    expect(depth.customProgramCacheKey()).toContain(first.uuid)
    expect(depth.version).toBe(initialDepthVersion + 1)

    mesh.onBeforeShadow({} as never, {} as never, {} as never, {} as never, mesh.geometry, depth, { materialIndex: 1 } as never)
    expect(depth.customProgramCacheKey()).toContain(second.uuid)
    expect(depth.version).toBe(initialDepthVersion + 2)

    mesh.onBeforeShadow({} as never, {} as never, {} as never, {} as never, mesh.geometry, distance, { materialIndex: 1 } as never)
    expect(distance.customProgramCacheKey()).toContain(second.uuid)
    expect(distance.version).toBe(initialDistanceVersion + 1)
  })
})

describe('sdef geometry layout', () => {
  it('retains PMX SDEF C/R0/R1 in loader-owned geometry attributes', () => {
    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const pmx = {
      bones: [],
      displayFrames: [],
      header: { additionalVec4Count: 0, boneIndexSize: 4, comment: '', encoding: 1, englishComment: '', englishModelName: '', materialIndexSize: 4, modelName: '', morphIndexSize: 4, signature: 'PMX', textureIndexSize: 4, version: 2, vertexIndexSize: 4 },
      indices: new Uint8Array(),
      joints: [],
      materials: [],
      morphs: [],
      rigidBodies: [],
      softBodies: [],
      textures: [],
      vertices: [{ additionalVec4: [], boneWeight: { boneIndices: [0, 1], boneWeights: { boneWeight0: 0.25, c: [1, 2, 3], r0: [4, 5, 6], r1: [7, 8, 9] } }, edgeScale: 1, normal: [0, 1, 0], position: [0, 0, 0], uv: [0, 0], weightType: 3 }],
    } as unknown as PmxObject

    const geometry = buildGeometry(pmx)
    expect(Array.from(geometry.getAttribute('mmdSdefMask').array)).toEqual([1])
    expect(Array.from(geometry.getAttribute('mmdSdefC').array)).toEqual([1, 2, 3])
    expect(Array.from(geometry.getAttribute('mmdSdefR0').array)).toEqual([4, 5, 6])
    expect(Array.from(geometry.getAttribute('mmdSdefR1').array)).toEqual([7, 8, 9])
  })
})
