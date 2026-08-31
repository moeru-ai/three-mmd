import type { MMDMaterialDescriptor } from '../src/materials/types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { BufferGeometry, Color, DoubleSide, LoadingManager, ShaderLib, Texture, TextureLoader } from 'three'
import { describe, expect, it, vi } from 'vitest'

import {
  resolveMMDAlphaPolicy,
  resolveMMDTextureAlphaMode,
} from '../src/materials/core/alpha-policy'
import { createMMDMaterialEvaluatedState } from '../src/materials/morph'
import {
  MMD_PHYSICAL_MATERIAL_MAPPING,
  MMDPhysicalMaterial,
  mmdShininessToRoughness,
  resolveMMDPhysicalSpecularColor,
} from '../src/materials/physical'
import { MMDToonMaterial } from '../src/materials/toon/mmd-toon-material'
import { applyMorphTransparencyFix, buildMaterial, isPmxMaterialDoubleSided } from '../src/utils/build-material'

const texturedPmx = (): PmxObject => ({
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
  materials: [{
    ambient: [0, 0, 0],
    comment: '',
    diffuse: [1, 1, 1, 1],
    edgeColor: [0, 0, 0, 1],
    edgeSize: 0,
    englishName: '',
    flag: 0,
    indexCount: 0,
    isSharedToonTexture: false,
    name: 'textured material',
    shininess: 16,
    specular: [0, 0, 0],
    sphereTextureIndex: 1,
    sphereTextureMode: PmxObject.Material.SphereTextureMode.Add,
    textureIndex: 0,
    toonTextureIndex: 2,
  }],
  morphs: [],
  rigidBodies: [],
  softBodies: [],
  textures: ['diffuse.png', 'sphere.png', 'toon.png'],
  vertices: [],
})

const descriptor = (): MMDMaterialDescriptor => ({
  ambient: new Color(0.1, 0.2, 0.3),
  diffuse: new Color(0.4, 0.5, 0.6),
  doubleSided: true,
  fog: true,
  isDefaultToonTexture: true,
  map: new Texture(),
  name: 'physical test material',
  opacity: 1,
  outline: { alpha: 1, color: new Color(0.1, 0.1, 0.1), visible: true, width: 0.01 },
  shininess: 16,
  specular: new Color(0.2, 0.3, 0.4),
  sphereBlendMode: 'add',
  sphereMap: new Texture(),
  toonMap: new Texture(),
  toonMapFileName: 'toon01.bmp',
})

describe('mmd physical material mapping', () => {
  it('loads only backend-supported MMD textures', () => {
    const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((() => new Texture()) as never)
    const pmx = texturedPmx()
    const manager = new LoadingManager()

    try {
      const physical = buildMaterial(pmx, new BufferGeometry(), '', manager, MMDPhysicalMaterial)
      const physicalMaterial = physical[0] as MMDPhysicalMaterial

      expect(load.mock.calls.map(([url]) => url)).toEqual(['diffuse.png'])
      expect(physicalMaterial.descriptor.sphereMap).toBeUndefined()
      expect(physicalMaterial.descriptor.toonMap).toBeUndefined()

      load.mockClear()
      const toon = buildMaterial(pmx, new BufferGeometry(), '', manager, MMDToonMaterial)
      const toonMaterial = toon[0] as MMDToonMaterial

      expect(load.mock.calls.map(([url]) => url)).toEqual(['diffuse.png', 'sphere.png', 'toon.png'])
      expect(toonMaterial.descriptor.sphereMap).toBeDefined()
      expect(toonMaterial.descriptor.toonMap).toBeDefined()
    }
    finally {
      load.mockRestore()
    }
  })

  it('maps Blinn-Phong shininess to inverse GGX roughness', () => {
    expect(mmdShininessToRoughness(-1)).toBe(1)
    expect(mmdShininessToRoughness(0)).toBe(1)
    expect(mmdShininessToRoughness(16)).toBeCloseTo(1 / 3)
    expect(mmdShininessToRoughness(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('publishes the precision boundary for every PMX appearance field', () => {
    expect(MMD_PHYSICAL_MATERIAL_MAPPING).toEqual({
      ambient: 'unsupported',
      diffuse: 'exact',
      diffuseTexture: 'exact',
      doubleSided: 'exact',
      metalness: 'unsupported',
      opacity: 'approximate',
      outline: 'unsupported',
      shininess: 'approximate',
      specular: 'approximate',
      sphereTexture: 'unsupported',
      textureMorphColor: 'unsupported',
      toonTexture: 'unsupported',
    })
  })

  it('maps PMX specular color only when the approximation is explicitly enabled', () => {
    const source = new Color(0.2, 0.3, 0.4)

    const ignored = resolveMMDPhysicalSpecularColor(source, 'ignore')
    const mapped = resolveMMDPhysicalSpecularColor(source, 'physical-color')

    expect(ignored).toBeUndefined()
    expect(mapped).not.toBe(source)
    expect(mapped?.toArray()).toEqual([0.2, 0.3, 0.4])
    expect(source.toArray()).toEqual([0.2, 0.3, 0.4])
  })

  it('matches Babylon alpha evaluation for cutout and blended texture samples', () => {
    expect(resolveMMDTextureAlphaMode([255, 255, 0, 0])).toBe('cutout')
    expect(resolveMMDTextureAlphaMode([255, 255, 55, 55])).toBe('blend')
    expect(resolveMMDTextureAlphaMode([255, 255, 255])).toBeUndefined()
  })

  it('derives raster sidedness only from the PMX double-sided flag', () => {
    expect(isPmxMaterialDoubleSided(0)).toBe(false)
    expect(isPmxMaterialDoubleSided(PmxObject.Material.Flag.EnabledToonEdge)).toBe(false)
    expect(isPmxMaterialDoubleSided(
      PmxObject.Material.Flag.IsDoubleSided | PmxObject.Material.Flag.EnabledToonEdge,
    )).toBe(true)
  })

  it('creates a dielectric Physical material from exact PMX base fields', () => {
    const source = descriptor()
    const diffuseBefore = source.diffuse.toArray()
    const specularBefore = source.specular.toArray()

    const material = new MMDPhysicalMaterial(source)

    expect(material.isMeshPhysicalMaterial).toBe(true)
    expect(material.name).toBe('physical test material')
    expect(material.color.toArray()).toEqual(diffuseBefore)
    expect(material.map).toBe(source.map)
    expect(material.opacity).toBe(1)
    expect(material.side).toBe(DoubleSide)
    expect(material.metalness).toBe(0)
    expect(material.roughness).toBeCloseTo(1 / 3)
    expect(material.specularColor.toArray()).toEqual([1, 1, 1])
    expect(material.mmdCapabilities.alpha).toEqual(['opaque', 'cutout', 'blend', 'mmd-depth-blend'])
    expect(material.mmdCapabilities.sphereTexture).toEqual([])
    expect(material.mmdCapabilities.toon).toBe(false)
    expect(source.diffuse.toArray()).toEqual(diffuseBefore)
    expect(source.specular.toArray()).toEqual(specularBefore)
  })

  it('maps evaluated shininess and opt-in PMX specular through replaceable policies', () => {
    const source = descriptor()
    const material = new MMDPhysicalMaterial(source, {
      shininessToRoughness: shininess => shininess / 100,
      specularMode: 'physical-color',
    })
    const state = createMMDMaterialEvaluatedState(source)
    state.diffuse.setRGB(0.7, 0.6, 0.5)
    state.opacity = 0.75
    state.shininess = 64
    state.specular.setRGB(0.9, 0.8, 0.7)

    material.applyMMDMaterialState(state)

    expect(material.color.toArray()).toEqual([0.7, 0.6, 0.5])
    expect(material.opacity).toBe(0.75)
    expect(material.roughness).toBeCloseTo(0.64)
    expect(material.specularColor.toArray()).toEqual([0.9, 0.8, 0.7])
    expect(source.shininess).toBe(16)
    expect(source.specular.toArray()).toEqual([0.2, 0.3, 0.4])
  })

  it('clones and copies the descriptor-backed Physical policy and SDEF define', () => {
    for (const sdefEnabled of [false, true]) {
      const source = new MMDPhysicalMaterial(descriptor(), {
        alphaMode: 'mmd-depth-blend',
        shininessToRoughness: () => 0.25,
        specularMode: 'physical-color',
      })
      const target = new MMDPhysicalMaterial(descriptor())
      source.setSdefEnabled(sdefEnabled)

      const clone = source.clone()
      target.copy(source)

      expect(clone).not.toBe(source)
      expect(clone.descriptor).toBe(source.descriptor)
      expect(clone.alphaMode).toBe('mmd-depth-blend')
      expect(clone.specularMode).toBe('physical-color')
      expect(clone.defines?.MMD_USE_SDEF).toBe(sdefEnabled ? 1 : 0)
      expect(target.descriptor).toBe(source.descriptor)
      expect(target.shininessToRoughness(16)).toBe(0.25)
      expect(target.defines?.MMD_USE_SDEF).toBe(sdefEnabled ? 1 : 0)
    }
  })

  it('invalidates the Physical shader after copy changes the SDEF define', () => {
    const source = new MMDPhysicalMaterial(descriptor())
    const target = new MMDPhysicalMaterial(descriptor())
    target.setSdefEnabled(false)
    const version = target.version

    target.copy(source)

    expect(target.defines?.MMD_USE_SDEF).toBe(1)
    expect(target.version).toBeGreaterThan(version)
  })

  it('keeps the native Physical lighting and IBL shader seams', () => {
    const material = new MMDPhysicalMaterial(descriptor())
    const shader = {
      fragmentShader: ShaderLib.physical.fragmentShader,
      uniforms: {},
      vertexShader: ShaderLib.physical.vertexShader,
    }

    material.onBeforeCompile(shader as never, {} as never)

    expect(shader.fragmentShader).toContain('#include <lights_physical_fragment>')
    expect(shader.fragmentShader).toContain('#include <envmap_physical_pars_fragment>')
    expect(shader.fragmentShader).not.toContain('mmdToonMap')
    expect(shader.fragmentShader).not.toContain('mmdSphereMap')
    expect(shader.vertexShader).toContain('mmdSdefMask')
    expect(material.customProgramCacheKey()).toContain('mmd-physical')
  })
})

describe('mmd alpha policy', () => {
  it('evaluates scalar and texture alpha without changing the requested explicit mode', () => {
    expect(resolveMMDAlphaPolicy({ mode: 'evaluate', opacity: 1, textureHasTransparency: false })).toBe('opaque')
    expect(resolveMMDAlphaPolicy({ mode: 'evaluate', opacity: 0.5, textureHasTransparency: false })).toBe('blend')
    expect(resolveMMDAlphaPolicy({ mode: 'evaluate', opacity: 1, textureHasTransparency: true })).toBe('blend')
    expect(resolveMMDAlphaPolicy({ mode: 'evaluate', opacity: 1, textureAlphaMode: 'cutout', textureHasTransparency: true })).toBe('cutout')
    expect(resolveMMDAlphaPolicy({ alphaTest: 0.3, mode: 'evaluate', opacity: 1, textureHasTransparency: false })).toBe('cutout')
    expect(resolveMMDAlphaPolicy({ mode: 'cutout', opacity: 1, textureHasTransparency: false })).toBe('cutout')
    expect(resolveMMDAlphaPolicy({ mode: 'mmd-depth-blend', opacity: 1, textureHasTransparency: false })).toBe('mmd-depth-blend')
  })

  it('uses depth-writing blending for evaluated MMD alpha while keeping conventional blending opt-in', () => {
    const translucentDescriptor = { ...descriptor(), opacity: 0.5 }
    const evaluated = new MMDPhysicalMaterial(translucentDescriptor)
    const conventional = new MMDPhysicalMaterial(descriptor(), { alphaMode: 'blend' })
    const cutout = new MMDPhysicalMaterial(descriptor(), { alphaMode: 'cutout' })
    const mmdBlend = new MMDPhysicalMaterial(descriptor(), { alphaMode: 'mmd-depth-blend' })

    expect(evaluated.transparent).toBe(true)
    expect(evaluated.depthWrite).toBe(true)
    expect(conventional.transparent).toBe(true)
    expect(conventional.depthWrite).toBe(false)
    expect(cutout.transparent).toBe(false)
    expect(cutout.depthWrite).toBe(true)
    expect(cutout.alphaTest).toBe(0.5)
    expect(mmdBlend.transparent).toBe(true)
    expect(mmdBlend.depthWrite).toBe(true)
  })

  it('uses depth-writing blending for evaluated texture cutout alpha', () => {
    const source = descriptor()
    const material = new MMDPhysicalMaterial(source)

    material.setMMDTextureAlphaMode('cutout')

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(true)
    expect(material.alphaTest).toBe(0)
  })

  it('keeps alpha results local when materials share a diffuse texture', () => {
    const sharedMap = new Texture()
    const cutout = new MMDPhysicalMaterial({ ...descriptor(), map: sharedMap })
    const blend = new MMDPhysicalMaterial({ ...descriptor(), map: sharedMap })

    cutout.setMMDTextureAlphaMode('cutout')
    blend.setMMDTextureAlphaMode('blend')

    expect(cutout.transparent).toBe(true)
    expect(cutout.depthWrite).toBe(true)
    expect(cutout.alphaTest).toBe(0)
    expect(blend.transparent).toBe(true)
    expect(blend.depthWrite).toBe(true)
  })

  it('preserves evaluated texture alpha through copy and state updates', () => {
    const sourceDescriptor = { ...descriptor(), textureAlphaMode: 'cutout' as const }
    const source = new MMDPhysicalMaterial(sourceDescriptor)
    const target = new MMDPhysicalMaterial(descriptor())

    target.copy(source)
    target.applyMMDMaterialState(createMMDMaterialEvaluatedState(sourceDescriptor))

    expect(target.transparent).toBe(true)
    expect(target.depthWrite).toBe(true)
    expect(target.alphaTest).toBe(0)
  })

  it('propagates asynchronous diffuse texture alpha to both material backends', () => {
    const physicalDescriptor = descriptor()
    const toonDescriptor = descriptor()
    const physical = new MMDPhysicalMaterial(physicalDescriptor)
    const toon = new MMDToonMaterial(toonDescriptor)

    physical.setMMDTextureAlphaMode('blend')
    toon.setMMDTextureAlphaMode('blend')

    expect(physical.transparent).toBe(true)
    expect(physical.depthWrite).toBe(true)
    expect(toon.transparent).toBe(true)
    expect(toon.depthWrite).toBe(true)
  })

  it('keeps the texture alpha binding synchronized when a Toon material is copied', () => {
    const source = new MMDToonMaterial({ ...descriptor(), textureAlphaMode: 'blend' })
    const target = new MMDToonMaterial(descriptor())

    target.copy(source)

    expect(target.transparent).toBe(true)
    expect(target.depthWrite).toBe(true)
  })

  it('uses the selected alpha policy when a material morph can change opacity', () => {
    const physical = new MMDPhysicalMaterial(descriptor())
    const morph: PmxObject.Morph.MaterialMorph = {
      category: 4,
      elements: [{
        ambient: [0, 0, 0],
        diffuse: [1, 1, 1, 0.5],
        edgeColor: [0, 0, 0, 0],
        edgeSize: 0,
        index: 0,
        shininess: 0,
        specular: [0, 0, 0],
        sphereTextureColor: [0, 0, 0, 0],
        textureColor: [0, 0, 0, 0],
        toonTextureColor: [0, 0, 0, 0],
        type: 1,
      }],
      englishName: 'alpha',
      name: 'alpha',
      type: 8,
    }

    applyMorphTransparencyFix([physical], [morph])

    expect(physical.transparent).toBe(true)
    expect(physical.depthWrite).toBe(true)
  })
})
