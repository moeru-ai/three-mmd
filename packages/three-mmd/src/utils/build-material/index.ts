import type { BufferGeometry, LoadingManager, Material } from 'three'

import type { MMDMaterialConstructor, MMDMaterialDescriptor } from '../../materials/types'
import type { TextureContext } from './types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  Color,
  CustomBlending,
  DefaultLoadingManager,
  DoubleSide,
  DstAlphaFactor,
  FrontSide,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { TGALoader } from 'three/addons/loaders/TGALoader.js'

import { MMDToonMaterial } from '../../materials/toon/mmd-toon-material'
import { isMMDMaterial } from '../../materials/types'
import { checkImageTransparency, loadTextureResource } from './utils'

export const mapPmxMaterialSide = (flag: number): typeof DoubleSide | typeof FrontSide => (
  (flag & PmxObject.Material.Flag.IsDoubleSided) !== 0 ? DoubleSide : FrontSide
)

export const mapPmxToMaterialDescriptor = (
  material: PmxObject.Material,
  pmxTextures: readonly string[],
  geometry: BufferGeometry,
  ctx: TextureContext,
  groupIndex: number,
): MMDMaterialDescriptor => {
  const diffuse = new Color().setRGB(material.diffuse[0], material.diffuse[1], material.diffuse[2], SRGBColorSpace)
  const opacity = material.diffuse[3]
  const mapFileName = material.textureIndex === -1 ? undefined : pmxTextures[material.textureIndex]
  const map = mapFileName === undefined ? undefined : loadTextureResource(mapFileName, ctx)

  const sphereMapFileName = material.sphereTextureIndex === -1 ? undefined : pmxTextures[material.sphereTextureIndex]
  const sphereBlendMode = material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
    ? 'multiply'
    : material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Add
      ? 'add'
      : undefined
  const sphereMap = sphereMapFileName !== undefined && sphereBlendMode !== undefined
    ? loadTextureResource(sphereMapFileName, ctx)
    : undefined

  const isDefaultToonTexture = material.isSharedToonTexture || material.toonTextureIndex === -1
  const toonMapFileName = isDefaultToonTexture
    ? `toon${(`0${material.toonTextureIndex + 1}`).slice(-2)}.bmp`
    : pmxTextures[material.toonTextureIndex]

  const descriptor: MMDMaterialDescriptor = {
    ambient: new Color().setRGB(...material.ambient, SRGBColorSpace),
    blendDst: OneMinusSrcAlphaFactor,
    blendDstAlpha: DstAlphaFactor,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendSrcAlpha: SrcAlphaFactor,
    diffuse,
    fog: true,
    isDefaultToonTexture,
    map,
    mapFileName,
    name: material.name,
    opacity,
    outline: {
      alpha: material.edgeColor[3],
      color: new Color().setRGB(material.edgeColor[0], material.edgeColor[1], material.edgeColor[2], SRGBColorSpace),
      visible: (material.flag & PmxObject.Material.Flag.EnabledToonEdge) !== 0 && material.edgeSize > 0,
      width: material.edgeSize / 300,
    },
    shininess: material.shininess,
    side: mapPmxMaterialSide(material.flag),
    specular: new Color().setRGB(...material.specular, SRGBColorSpace),
    sphereBlendMode,
    sphereMap,
    sphereMapFileName,
    toonMap: loadTextureResource(toonMapFileName, ctx, { isDefaultToonTexture, isToonTexture: true }),
    toonMapFileName,
    transparent: opacity !== 1,
  }

  if (map !== undefined && opacity === 1)
    checkImageTransparency(map, geometry, groupIndex, (mode) => { descriptor.textureAlphaMode = mode })

  return descriptor
}

export const applyMorphTransparencyFix = (materials: Material[], morphs: readonly PmxObject.Morph[]) => {
  const checkAlphaMorph = (elements: PmxObject.Morph.MaterialMorph['elements'], targetMaterials: Material[]) => {
    for (const element of elements) {
      const material = element.index === -1 ? undefined : targetMaterials[element.index]
      if (material === undefined || material.opacity === element.diffuse[3])
        continue

      if (isMMDMaterial(material)) {
        material.setMMDAlphaMorphEnabled(true)
      }
      else {
        material.transparent = true
      }
    }
  }

  for (const morph of morphs) {
    if (morph.type === PmxObject.Morph.Type.GroupMorph) {
      for (const index of morph.indices) {
        const child = morphs[index]
        if (child?.type === PmxObject.Morph.Type.MaterialMorph)
          checkAlphaMorph(child.elements, materials)
      }
    }
    else if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
      checkAlphaMorph(morph.elements, materials)
    }
  }
}

export const buildMaterial = (
  data: PmxObject,
  geometry: BufferGeometry,
  resourcePath: string,
  customManager?: LoadingManager,
  materialType: MMDMaterialConstructor = MMDToonMaterial,
  onProgress?: (event: ProgressEvent) => void,
  onError?: (event: unknown) => void,
) => {
  const manager = customManager ?? DefaultLoadingManager
  const textureLoader = new TextureLoader(manager)
  textureLoader.setCrossOrigin('anonymous')
  let tgaLoader: TGALoader | undefined
  const ctx: TextureContext = {
    getTGALoader: () => (tgaLoader ??= new TGALoader(manager)),
    manager,
    onError,
    onProgress,
    resourcePath,
    textureLoader,
    textures: {},
  }

  // eslint-disable-next-line new-cap
  const materials = data.materials.map((pmxMaterial, index) => new materialType(
    mapPmxToMaterialDescriptor(pmxMaterial, data.textures, geometry, ctx, index),
  ))
  applyMorphTransparencyFix(materials, data.morphs)
  return materials
}
