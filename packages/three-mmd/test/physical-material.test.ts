import type { MMDMaterialDescriptor } from '../src/materials/types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Color, DoubleSide, FrontSide, ShaderLib, Texture } from 'three'
import { describe, expect, it } from 'vitest'

import { markMMDTextureTransparent, resolveMMDAlphaPolicy } from '../src/materials/core/alpha-policy'
import { createMMDMaterialEvaluatedState } from '../src/materials/morph'
import {
  MMD_PHYSICAL_MATERIAL_MAPPING,
  MMDPhysicalMaterial,
  mmdShininessToRoughness,
  resolveMMDPhysicalSpecularColor,
} from '../src/materials/physical'
import { MMDToonMaterial } from '../src/materials/toon/mmd-toon-material'
import { applyMorphTransparencyFix, mapPmxMaterialSide } from '../src/utils/build-material'

const descriptor = (): MMDMaterialDescriptor => ({
  ambient: new Color(0.1, 0.2, 0.3),
  diffuse: new Color(0.4, 0.5, 0.6),
  fog: true,
  isDefaultToonTexture: true,
  map: new Texture(),
  name: 'physical test material',
  opacity: 1,
  outline: { alpha: 1, color: new Color(0.1, 0.1, 0.1), visible: true, width: 0.01 },
  shininess: 16,
  side: DoubleSide,
  specular: new Color(0.2, 0.3, 0.4),
  sphereBlendMode: 'add',
  sphereMap: new Texture(),
  toonMap: new Texture(),
  toonMapFileName: 'toon01.bmp',
  transparent: false,
})

describe('mmd physical material mapping', () => {
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

  it('derives raster sidedness only from the PMX double-sided flag', () => {
    expect(mapPmxMaterialSide(0)).toBe(FrontSide)
    expect(mapPmxMaterialSide(PmxObject.Material.Flag.EnabledToonEdge)).toBe(FrontSide)
    expect(mapPmxMaterialSide(
      PmxObject.Material.Flag.IsDoubleSided | PmxObject.Material.Flag.EnabledToonEdge,
    )).toBe(DoubleSide)
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

  it('clones and copies the descriptor-backed Physical policy', () => {
    const source = new MMDPhysicalMaterial(descriptor(), {
      alphaMode: 'mmd-depth-blend',
      shininessToRoughness: () => 0.25,
      specularMode: 'physical-color',
    })
    const target = new MMDPhysicalMaterial(descriptor())

    const clone = source.clone()
    target.copy(source)

    expect(clone).not.toBe(source)
    expect(clone.descriptor).toBe(source.descriptor)
    expect(clone.alphaMode).toBe('mmd-depth-blend')
    expect(clone.specularMode).toBe('physical-color')
    expect(target.descriptor).toBe(source.descriptor)
    expect(target.shininessToRoughness(16)).toBe(0.25)
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
    expect(resolveMMDAlphaPolicy({ alphaTest: 0.3, mode: 'evaluate', opacity: 1, textureHasTransparency: false })).toBe('cutout')
    expect(resolveMMDAlphaPolicy({ mode: 'cutout', opacity: 1, textureHasTransparency: false })).toBe('cutout')
    expect(resolveMMDAlphaPolicy({ mode: 'mmd-depth-blend', opacity: 1, textureHasTransparency: false })).toBe('mmd-depth-blend')
  })

  it('applies conventional Physical blending while keeping explicit cutout and MMD depth modes available', () => {
    const translucentDescriptor = { ...descriptor(), opacity: 0.5, transparent: true }
    const evaluated = new MMDPhysicalMaterial(translucentDescriptor)
    const cutout = new MMDPhysicalMaterial(descriptor(), { alphaMode: 'cutout' })
    const mmdBlend = new MMDPhysicalMaterial(descriptor(), { alphaMode: 'mmd-depth-blend' })

    expect(evaluated.transparent).toBe(true)
    expect(evaluated.depthWrite).toBe(false)
    expect(cutout.transparent).toBe(false)
    expect(cutout.depthWrite).toBe(true)
    expect(cutout.alphaTest).toBe(0.5)
    expect(mmdBlend.transparent).toBe(true)
    expect(mmdBlend.depthWrite).toBe(true)
  })

  it('propagates asynchronous diffuse texture alpha to both material backends', () => {
    const physicalDescriptor = descriptor()
    const toonDescriptor = descriptor()
    const physical = new MMDPhysicalMaterial(physicalDescriptor)
    const toon = new MMDToonMaterial(toonDescriptor)

    markMMDTextureTransparent(physicalDescriptor.map!)
    markMMDTextureTransparent(toonDescriptor.map!)

    expect(physical.transparent).toBe(true)
    expect(physical.depthWrite).toBe(false)
    expect(toon.transparent).toBe(true)
    expect(toon.depthWrite).toBe(true)
  })

  it('keeps the texture alpha binding synchronized when a Toon material is copied', () => {
    const source = new MMDToonMaterial(descriptor())
    const target = new MMDToonMaterial(descriptor())

    target.copy(source)
    markMMDTextureTransparent(source.map!)

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
    expect(physical.depthWrite).toBe(false)
  })
})
