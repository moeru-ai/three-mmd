import type { BufferGeometry, LoadingManager, Material } from 'three'

import type {
  MMDMaterial,
  MMDMaterialConstructor,
  MMDMaterialParameters,
  MMDTextureAlphaMode,
} from '../../materials/types'
import type { TextureContext } from './types'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  Color,
  DefaultLoadingManager,
  DoubleSide,
  FrontSide,
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

const mapPmxToMaterialParameters = (
  material: PmxObject.Material,
  pmxTextures: readonly string[],
  geometry: BufferGeometry,
  ctx: TextureContext,
  groupIndex: number,
  onAlphaMode: (mode: MMDTextureAlphaMode) => void,
): MMDMaterialParameters => {
  const opacity = material.diffuse[3]
  const map = material.textureIndex === -1
    ? null
    : loadTextureResource(pmxTextures[material.textureIndex], ctx)

  const sphereBlendMode = material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
    ? 'multiply'
    : material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Add
      ? 'add'
      : null
  const sphereMap = material.sphereTextureIndex === -1 || sphereBlendMode === null
    ? null
    : loadTextureResource(pmxTextures[material.sphereTextureIndex], ctx)

  const isDefaultToonTexture = material.isSharedToonTexture || material.toonTextureIndex === -1
  const toonMapFileName = isDefaultToonTexture
    ? `toon${(`0${material.toonTextureIndex + 1}`).slice(-2)}.bmp`
    : pmxTextures[material.toonTextureIndex]

  if (map !== null && opacity === 1)
    checkImageTransparency(map, geometry, groupIndex, onAlphaMode)

  return {
    ambient: new Color().setRGB(...material.ambient, SRGBColorSpace),
    color: new Color().setRGB(material.diffuse[0], material.diffuse[1], material.diffuse[2], SRGBColorSpace),
    map,
    name: material.name,
    opacity,
    shininess: material.shininess,
    side: opacity !== 1 || isPmxMaterialDoubleSided(material.flag) ? DoubleSide : FrontSide,
    specular: new Color().setRGB(...material.specular, SRGBColorSpace),
    sphereBlendMode,
    sphereMap,
    toonMap: loadTextureResource(toonMapFileName, ctx, { isDefaultToonTexture, isToonTexture: true }),
  }
}

export const applyMorphTransparencyFix = (materials: Material[], morphs: readonly PmxObject.Morph[]) => {
  const checkAlphaMorph = (elements: PmxObject.Morph.MaterialMorph['elements'], targetMaterials: Material[]) => {
    for (const element of elements) {
      const material = element.index === -1 ? undefined : targetMaterials[element.index]
      if (material === undefined || material.opacity === element.diffuse[3])
        continue

      if (isMMDMaterial(material)) {
        material.alphaMorph = true
        material.updateAlpha()
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
  MaterialType: MMDMaterialConstructor = MMDToonMaterial,
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
  for (const [index, pmxMaterial] of data.materials.entries()) {
    const parameters = mapPmxToMaterialParameters(pmxMaterial, data.textures, geometry, ctx, index, (mode) => {
      const material = materials[index]
      material.textureAlphaMode = mode
      material.updateAlpha()
    })
    materials.push(new MaterialType(parameters))
  }

  applyMorphTransparencyFix(materials, data.morphs)
  return materials
}
