import type { BufferGeometry, LoadingManager, Material } from 'three'

import type { MMDTextureAlphaMode } from '../../materials/core/alpha-policy'
import type {
  MMDMaterial,
  MMDMaterialCapabilities,
  MMDMaterialConstructor,
  MMDMaterialDescriptor,
} from '../../materials/types'
import type { TextureContext } from './types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  Color,
  DefaultLoadingManager,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { TGALoader } from 'three/addons/loaders/TGALoader.js'

import { MMDToonMaterial } from '../../materials/toon/mmd-toon-material'
import { isMMDMaterial } from '../../materials/types'
import { checkImageTransparency, loadTextureResource } from './utils'

export const isPmxMaterialDoubleSided = (flag: number): boolean => (
  (flag & PmxObject.Material.Flag.IsDoubleSided) !== 0
)

export const mapPmxToMaterialDescriptor = (
  material: PmxObject.Material,
  pmxTextures: readonly string[],
  geometry: BufferGeometry,
  ctx: TextureContext,
  groupIndex: number,
  onAlphaMode?: (mode: MMDTextureAlphaMode) => void,
  textureCapabilities?: Pick<MMDMaterialCapabilities, 'sphereTexture' | 'toon'>,
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
  const sphereTextureSupported = textureCapabilities === undefined
    || (sphereBlendMode !== undefined && textureCapabilities.sphereTexture.includes(sphereBlendMode))
  const sphereMap = sphereTextureSupported && sphereMapFileName !== undefined && sphereBlendMode !== undefined
    ? loadTextureResource(sphereMapFileName, ctx)
    : undefined

  const isDefaultToonTexture = material.isSharedToonTexture || material.toonTextureIndex === -1
  const toonMapFileName = isDefaultToonTexture
    ? `toon${(`0${material.toonTextureIndex + 1}`).slice(-2)}.bmp`
    : pmxTextures[material.toonTextureIndex]

  const descriptor: MMDMaterialDescriptor = {
    ambient: new Color().setRGB(...material.ambient, SRGBColorSpace),
    diffuse,
    doubleSided: isPmxMaterialDoubleSided(material.flag),
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
    specular: new Color().setRGB(...material.specular, SRGBColorSpace),
    sphereBlendMode,
    sphereMap,
    sphereMapFileName,
    toonMap: textureCapabilities === undefined || textureCapabilities.toon
      ? loadTextureResource(toonMapFileName, ctx, { isDefaultToonTexture, isToonTexture: true })
      : undefined,
    toonMapFileName,
  }

  if (map !== undefined && opacity === 1) {
    checkImageTransparency(map, geometry, groupIndex, (mode) => {
      descriptor.textureAlphaMode = mode
      onAlphaMode?.(mode)
    })
  }

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

  const materials: MMDMaterial[] = []
  const textureCapabilities = materialType.mmdCapabilities
  const descriptors = data.materials.map((pmxMaterial, index) => mapPmxToMaterialDescriptor(
    pmxMaterial,
    data.textures,
    geometry,
    ctx,
    index,
    mode => materials[index]?.setMMDTextureAlphaMode(mode),
    textureCapabilities === undefined
      ? undefined
      : {
          sphereTexture: textureCapabilities.sphereTexture,
          toon: textureCapabilities.toon,
        },
  ))

  const MaterialType = materialType
  for (const descriptor of descriptors)
    materials.push(new MaterialType(descriptor))

  applyMorphTransparencyFix(materials, data.morphs)
  return materials
}
