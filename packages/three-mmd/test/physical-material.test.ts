import type { MMDMaterialParameters } from '../src/materials/types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { BufferGeometry, Color, DoubleSide, FrontSide, LoadingManager, ShaderLib, Texture, TextureLoader } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { createMMDMaterialEvaluatedState } from '../src/materials/morph'
import { MMDPhysicalMaterial } from '../src/materials/physical'
import { setSdefEnabled } from '../src/materials/sdef'
import { MMDToonMaterial } from '../src/materials/toon/mmd-toon-material'
import { applyMorphTransparencyFix, buildMaterial, isPmxMaterialDoubleSided } from '../src/utils/build-material'
import { resolveMMDTextureAlphaMode } from '../src/utils/build-material/utils'

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

const parameters = (): MMDMaterialParameters => ({
  ambient: new Color(0.1, 0.2, 0.3),
  color: new Color(0.4, 0.5, 0.6),
  map: new Texture(),
  name: 'physical test material',
  shininess: 16,
  side: DoubleSide,
  specular: new Color(0.2, 0.3, 0.4),
  sphereBlendMode: 'add',
  sphereMap: new Texture(),
  toonMap: new Texture(),
})

describe('mmd physical material', () => {
  it('passes PMX textures to every backend and lets each one pick what it supports', () => {
    const load = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((() => new Texture()) as never)
    const manager = new LoadingManager()

    try {
      const [physical] = buildMaterial(texturedPmx(), new BufferGeometry(), '', manager, MMDPhysicalMaterial) as [MMDPhysicalMaterial]
      const [toon] = buildMaterial(texturedPmx(), new BufferGeometry(), '', manager, MMDToonMaterial) as [MMDToonMaterial]

      expect(physical.map).toBeInstanceOf(Texture)
      expect('sphereMap' in physical).toBe(false)
      expect(toon.sphereMap).toBeInstanceOf(Texture)
      expect(toon.toonMap).toBeInstanceOf(Texture)
    }
    finally {
      load.mockRestore()
    }
  })

  it('matches Babylon alpha evaluation for cutout and blended texture samples', () => {
    expect(resolveMMDTextureAlphaMode([255, 255, 0, 0])).toBe('cutout')
    expect(resolveMMDTextureAlphaMode([255, 255, 55, 55])).toBe('blend')
    expect(resolveMMDTextureAlphaMode([255, 255, 255])).toBeUndefined()
  })

  it('derives raster sidedness from the PMX double-sided flag', () => {
    expect(isPmxMaterialDoubleSided(0)).toBe(false)
    expect(isPmxMaterialDoubleSided(PmxObject.Material.Flag.EnabledToonEdge)).toBe(false)
    expect(isPmxMaterialDoubleSided(
      PmxObject.Material.Flag.IsDoubleSided | PmxObject.Material.Flag.EnabledToonEdge,
    )).toBe(true)
  })

  it('creates a dielectric Physical material and maps shininess to roughness', () => {
    const source = parameters()
    const material = new MMDPhysicalMaterial(source)

    expect(material.isMeshPhysicalMaterial).toBe(true)
    expect(material.name).toBe('physical test material')
    expect(material.color.toArray()).toEqual(new Color(0.4, 0.5, 0.6).toArray())
    expect(material.map).toBe(source.map)
    expect(material.side).toBe(DoubleSide)
    expect(material.metalness).toBe(0)
    expect(material.roughness).toBeCloseTo(1 / 3)
    expect(new MMDPhysicalMaterial({ shininess: 0 }).roughness).toBe(1)
    expect(new MMDPhysicalMaterial({ shininess: Number.POSITIVE_INFINITY }).roughness).toBe(0)
  })

  it('applies evaluated material state', () => {
    const material = new MMDPhysicalMaterial(parameters())
    const state = createMMDMaterialEvaluatedState(new MMDToonMaterial(parameters()))
    state.diffuse.setRGB(0.7, 0.6, 0.5)
    state.opacity = 0.75
    state.shininess = 98

    material.applyMMDMaterialState(state)

    expect(material.color.toArray()).toEqual([0.7, 0.6, 0.5])
    expect(material.opacity).toBe(0.75)
    expect(material.roughness).toBeCloseTo(Math.sqrt(0.02))
    expect(material.transparent).toBe(true)
  })

  it('clones and copies MMD state and the SDEF define', () => {
    for (const sdefEnabled of [false, true]) {
      const source = new MMDPhysicalMaterial(parameters())
      source.textureAlphaMode = 'blend'
      setSdefEnabled(source, sdefEnabled)
      const target = new MMDPhysicalMaterial()

      const clone = source.clone()
      target.copy(source)

      for (const material of [clone, target]) {
        expect(material).not.toBe(source)
        expect(material.textureAlphaMode).toBe('blend')
        expect(material.transparent).toBe(true)
        expect(material.defines?.MMD_USE_SDEF).toBe(sdefEnabled ? 1 : 0)
      }
    }
  })

  it('invalidates the Physical shader after copy changes the SDEF define', () => {
    const source = new MMDPhysicalMaterial(parameters())
    const target = new MMDPhysicalMaterial(parameters())
    setSdefEnabled(target, false)
    const version = target.version

    target.copy(source)

    expect(target.defines?.MMD_USE_SDEF).toBe(1)
    expect(target.version).toBeGreaterThan(version)
  })

  it('keeps the native Physical lighting and IBL shader seams', () => {
    const material = new MMDPhysicalMaterial(parameters())
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
  })
})

describe('mmd alpha', () => {
  it('derives transparency from opacity, texture alpha and alpha morphs', () => {
    const material = new MMDToonMaterial(parameters())
    expect(material.transparent).toBe(false)

    material.alphaMorph = true
    material.updateAlpha()
    expect(material.transparent).toBe(true)

    material.alphaMorph = false
    material.opacity = 0.5
    material.updateAlpha()
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(true)
  })

  it('renders texture cutout as alpha test on Toon and depth-writing blend on Physical', () => {
    const toon = new MMDToonMaterial(parameters())
    const physical = new MMDPhysicalMaterial(parameters())

    for (const material of [toon, physical]) {
      material.textureAlphaMode = 'cutout'
      material.updateAlpha()
    }

    expect(toon.transparent).toBe(false)
    expect(toon.alphaTest).toBe(0.5)
    expect(physical.transparent).toBe(true)
    expect(physical.alphaTest).toBe(0)
    expect(physical.depthWrite).toBe(true)
  })

  it('keeps alpha results local when materials share a diffuse texture', () => {
    const map = new Texture()
    const cutout = new MMDToonMaterial({ ...parameters(), map })
    const blend = new MMDToonMaterial({ ...parameters(), map })

    cutout.textureAlphaMode = 'cutout'
    cutout.updateAlpha()
    blend.textureAlphaMode = 'blend'
    blend.updateAlpha()

    expect(cutout.transparent).toBe(false)
    expect(blend.transparent).toBe(true)
  })

  it('applies texture alpha passed as a constructor parameter', () => {
    const material = new MMDToonMaterial({ ...parameters(), textureAlphaMode: 'blend' })

    expect(material.transparent).toBe(true)
  })

  it('keeps single-sided materials single-sided', () => {
    expect(new MMDToonMaterial({ side: FrontSide }).side).toBe(FrontSide)
  })

  it('flags materials whose morphs can change opacity', () => {
    const physical = new MMDPhysicalMaterial(parameters())
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

    expect(physical.alphaMorph).toBe(true)
    expect(physical.transparent).toBe(true)
  })
})
