/* eslint-disable ts/unbound-method */

import { BufferGeometry, Color, CustomBlending, DoubleSide, Float32BufferAttribute, SkinnedMesh, Texture } from 'three'
import { MeshPhongNodeMaterial } from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import { installMMDMaterialBindings } from '../src/materials/bindings'
import { MMDToonNodeMaterial } from '../src/materials/toon-node/mmd-toon-node-material'
import { geometryHasSdef } from '../src/materials/toon-node/sdef'
import { isMMDMaterial } from '../src/materials/types'

const parameters = () => ({
  ambient: new Color(0.1, 0.2, 0.3),
  color: new Color(0.4, 0.5, 0.6),
  name: 'node material',
  shininess: 16,
  side: DoubleSide,
  sphereBlendMode: 'add' as const,
  sphereMap: new Texture(),
  toonMap: new Texture(),
})

describe('mmd toon node material', () => {
  it('extends the native Phong node material and takes its parameters', () => {
    const material = new MMDToonNodeMaterial(parameters())

    expect(material).toBeInstanceOf(MeshPhongNodeMaterial)
    expect(isMMDMaterial(material)).toBe(true)
    expect(material.name).toBe('node material')
    expect(material.color.toArray()).toEqual(new Color(0.4, 0.5, 0.6).toArray())
    expect(material.ambient.toArray()).toEqual(new Color(0.1, 0.2, 0.3).toArray())
    expect(material.sphereBlendMode).toBe('add')
    expect(material.blending).toBe(CustomBlending)
  })

  it('derives alpha like the other backends and rebuilds its node graph when it changes', () => {
    const material = new MMDToonNodeMaterial(parameters())
    const version = material.version

    material.textureAlphaMode = 'cutout'
    material.updateAlpha()

    expect(material.alphaTest).toBe(0.5)
    expect(material.transparent).toBe(false)
    expect(material.version).toBeGreaterThan(version)

    material.textureAlphaMode = 'blend'
    material.updateAlpha()

    expect(material.alphaTest).toBe(0)
    expect(material.transparent).toBe(true)
  })

  it('clones and copies the MMD properties', () => {
    const source = new MMDToonNodeMaterial(parameters())
    source.textureAlphaMode = 'blend'
    source.updateAlpha()

    for (const material of [source.clone(), new MMDToonNodeMaterial().copy(source)]) {
      expect(material).not.toBe(source)
      expect(material.ambient).not.toBe(source.ambient)
      expect(material.ambient.toArray()).toEqual(source.ambient.toArray())
      expect(material.toonMap).toBe(source.toonMap)
      expect(material.sphereMap).toBe(source.sphereMap)
      expect(material.transparent).toBe(true)
    }
  })

  it('only treats geometry with non-zero SDEF masks as SDEF', () => {
    const geometry = new BufferGeometry()
    expect(geometryHasSdef(geometry)).toBe(false)

    const plain = new BufferGeometry()
    plain.setAttribute('mmdSdefMask', new Float32BufferAttribute([0, 0], 1))
    expect(geometryHasSdef(plain)).toBe(false)

    const sdef = new BufferGeometry()
    sdef.setAttribute('mmdSdefMask', new Float32BufferAttribute([0, 1], 1))
    expect(geometryHasSdef(sdef)).toBe(true)
  })

  it('binds node materials without creating GLSL shadow materials', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('mmdSdefMask', new Float32BufferAttribute([1], 1))
    const mesh = new SkinnedMesh(geometry, [new MMDToonNodeMaterial(parameters())])
    const onBeforeShadow = mesh.onBeforeShadow

    installMMDMaterialBindings(mesh)

    expect(mesh.customDepthMaterial).toBeUndefined()
    expect(mesh.customDistanceMaterial).toBeUndefined()
    expect(mesh.onBeforeShadow).not.toBe(onBeforeShadow)
  })
})
