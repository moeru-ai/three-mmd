import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { MeshDepthMaterial, MeshDistanceMaterial } from 'three'

import type { MMDMaterialParameters } from '../src/materials/types'

import { Bone, BufferGeometry, Color, CustomBlending, DoubleSide, Float32BufferAttribute, FrontSide, NormalBlending, ShaderLib, Skeleton, SkinnedMesh, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MMDMaterialPlugin } from '../src/loaders/loader-plugin'
import { installMMDMaterialBindings } from '../src/materials/bindings'
import { applyMMDMaterialMorph, createMMDMaterialEvaluatedState } from '../src/materials/morph'
import { MMDPhysicalMaterial } from '../src/materials/physical/mmd-physical-material'
import { setSdefEnabled } from '../src/materials/sdef'
import { MMDToonMaterial } from '../src/materials/toon/mmd-toon-material'
import { buildGeometry } from '../src/utils/build-geometry'

const parameters = (): MMDMaterialParameters => ({
  ambient: new Color(0.1, 0.2, 0.3),
  color: new Color(0.4, 0.5, 0.6),
  name: 'test material',
  shininess: 16,
  side: DoubleSide,
  specular: new Color(0.2, 0.3, 0.4),
  sphereBlendMode: 'multiply',
  sphereMap: new Texture(),
  toonMap: new Texture(),
})

const skinnedMesh = (materials: MMDToonMaterial[]): SkinnedMesh => {
  const mesh = new SkinnedMesh(new BufferGeometry(), materials)
  const bone = new Bone()
  mesh.add(bone)
  mesh.bind(new Skeleton([bone]))
  return mesh
}

describe('mmd material backends', () => {
  it('extends the native Phong material and takes its parameters', () => {
    const toon = new MMDToonMaterial(parameters())

    expect(toon.isMeshPhongMaterial).toBe(true)
    expect(toon.name).toBe('test material')
    expect(toon.color.toArray()).toEqual(new Color(0.4, 0.5, 0.6).toArray())
    expect(toon.ambient.toArray()).toEqual(new Color(0.1, 0.2, 0.3).toArray())
    expect(toon.side).toBe(DoubleSide)
  })

  it('keeps the native material type so WebGLRenderer can find its shader', () => {
    expect(new MMDToonMaterial().type).toBe('MeshPhongMaterial')
    expect(new MMDPhysicalMaterial().type).toBe('MeshPhysicalMaterial')
  })

  it('does not pass undefined parameters to Three material constructors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const material = new MMDToonMaterial(parameters())

    expect(material).toBeInstanceOf(MMDToonMaterial)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lets each backend own its renderer blending defaults', () => {
    const toon = new MMDToonMaterial(parameters())
    const physical = new MMDPhysicalMaterial(parameters())

    expect(toon.blending).toBe(CustomBlending)
    expect(physical.blending).toBe(NormalBlending)
  })

  it('clones and copies the MMD properties', () => {
    const source = new MMDToonMaterial(parameters())
    source.textureAlphaMode = 'blend'
    source.updateAlpha()
    const target = new MMDToonMaterial()

    const clone = source.clone()
    target.copy(source)

    for (const material of [clone, target]) {
      expect(material).not.toBe(source)
      expect(material.ambient).not.toBe(source.ambient)
      expect(material.ambient.toArray()).toEqual(source.ambient.toArray())
      expect(material.toonMap).toBe(source.toonMap)
      expect(material.sphereMap).toBe(source.sphereMap)
      expect(material.sphereBlendMode).toBe('multiply')
      expect(material.defines?.MMD_SPHERE_BLEND_MODE).toBe(1)
      expect(material.transparent).toBe(true)
    }
  })

  it('invalidates the Toon shader after copy changes the SDEF define', () => {
    const source = new MMDToonMaterial(parameters())
    const target = new MMDToonMaterial(parameters())
    setSdefEnabled(target, false)
    const version = target.version

    target.copy(source)

    expect(target.defines?.MMD_USE_SDEF).toBe(1)
    expect(target.version).toBeGreaterThan(version)
  })

  it('selects a material class through MMDMaterialPlugin', () => {
    const plugin = new MMDMaterialPlugin({ manager: {} as never, resourcePath: '' }, { materialType: MMDToonMaterial })
    expect(plugin.name).toBe('MMDMaterialPlugin')
    expect(plugin.materialType).toBe(MMDToonMaterial)
  })

  it('selects the opt-in Physical backend through MMDMaterialPlugin', () => {
    const plugin = new MMDMaterialPlugin({ manager: {} as never, resourcePath: '' }, { materialType: MMDPhysicalMaterial })

    expect(plugin.materialType).toBe(MMDPhysicalMaterial)
  })

  it('uses Three gradient-map coordinates for the PMX toon ramp', () => {
    const material = new MMDToonMaterial(parameters())
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

  it('compiles sphere blending as a static shader variant', () => {
    const withSphere = new MMDToonMaterial(parameters())
    const withoutSphere = new MMDToonMaterial({ ...parameters(), sphereBlendMode: null, sphereMap: null })

    expect(withSphere.defines?.MMD_SPHERE_BLEND_MODE).toBe(1)
    expect(withoutSphere.defines?.MMD_SPHERE_BLEND_MODE).toBe(0)
  })

  it('evaluates multiply and additive material morph values', () => {
    const state = createMMDMaterialEvaluatedState(new MMDToonMaterial(parameters()))
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
  it('does not create a material outline mesh', () => {
    const material = new MMDToonMaterial(parameters())
    const mesh = skinnedMesh([material])
    installMMDMaterialBindings(mesh)

    expect(mesh.children.some(child => child.name.endsWith(':mmd-outline'))).toBe(false)
  })

  it('installs custom SDEF shadows only when the mesh has SDEF vertices', () => {
    const material = new MMDToonMaterial(parameters())
    const mesh = skinnedMesh([material])
    mesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([0], 1))

    installMMDMaterialBindings(mesh)

    expect(mesh.customDepthMaterial).toBeUndefined()
    expect(mesh.customDistanceMaterial).toBeUndefined()

    const sdefMesh = skinnedMesh([new MMDToonMaterial(parameters())])
    sdefMesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))
    installMMDMaterialBindings(sdefMesh)

    expect(sdefMesh.customDepthMaterial).toBeDefined()
    expect(sdefMesh.customDistanceMaterial).toBeDefined()
  })

  it('installs the same SDEF surface and shadow binding for Physical materials', () => {
    const material = new MMDPhysicalMaterial(parameters())
    const mesh = new SkinnedMesh(new BufferGeometry(), [material])
    const bone = new Bone()
    mesh.add(bone)
    mesh.bind(new Skeleton([bone]))
    mesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))

    installMMDMaterialBindings(mesh)

    expect(material.defines?.MMD_USE_SDEF).toBe(1)
    expect(mesh.customDepthMaterial).toBeDefined()
    expect(mesh.customDistanceMaterial).toBeDefined()
  })

  it('disables the SDEF shader variant for meshes without SDEF vertices', () => {
    const material = new MMDToonMaterial(parameters())
    const mesh = skinnedMesh([material])

    installMMDMaterialBindings(mesh)

    expect(material.defines?.MMD_USE_SDEF).toBe(0)
  })

  it('selects a distinct shadow program variant for each material group', () => {
    const first = new MMDToonMaterial({ ...parameters(), map: new Texture(), textureAlphaMode: 'cutout' })
    const second = new MMDToonMaterial({ ...parameters(), map: new Texture(), textureAlphaMode: 'cutout' })
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

  it('selects Physical shadow variants from each group alpha surface', () => {
    const firstMap = new Texture()
    const secondMap = new Texture()
    const first = new MMDPhysicalMaterial({ ...parameters(), map: firstMap, side: FrontSide })
    const second = new MMDPhysicalMaterial({ ...parameters(), map: secondMap, side: DoubleSide })
    first.alphaTest = 0.3
    second.alphaTest = 0.8
    const mesh = new SkinnedMesh(new BufferGeometry(), [first, second])
    const bone = new Bone()
    mesh.add(bone)
    mesh.bind(new Skeleton([bone]))
    mesh.geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))
    installMMDMaterialBindings(mesh)

    const depth = mesh.customDepthMaterial as MeshDepthMaterial
    const distance = mesh.customDistanceMaterial as MeshDistanceMaterial

    mesh.onBeforeShadow({} as never, {} as never, {} as never, {} as never, mesh.geometry, depth, { materialIndex: 0 } as never)
    expect(depth.customProgramCacheKey()).toContain(first.uuid)
    expect(depth.customProgramCacheKey()).toContain(`map:${firstMap.uuid}`)
    expect(depth.customProgramCacheKey()).toContain('alpha-test:true')
    expect(depth.customProgramCacheKey()).toContain(`side:${String(FrontSide)}`)

    mesh.onBeforeShadow({} as never, {} as never, {} as never, {} as never, mesh.geometry, distance, { materialIndex: 1 } as never)
    expect(distance.customProgramCacheKey()).toContain(second.uuid)
    expect(distance.customProgramCacheKey()).toContain(`map:${secondMap.uuid}`)
    expect(distance.customProgramCacheKey()).toContain('alpha-test:true')
    expect(distance.customProgramCacheKey()).toContain(`side:${String(DoubleSide)}`)
  })
})

describe('sdef geometry layout', () => {
  it('precomputes PMX SDEF RW0/RW1 for the shader', () => {
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
    expect(Array.from(geometry.getAttribute('mmdSdefRW0').array)).toEqual([-0.125, 0.875, 1.875])
    expect(Array.from(geometry.getAttribute('mmdSdefRW1').array)).toEqual([1.375, 2.375, 3.375])
  })
})
