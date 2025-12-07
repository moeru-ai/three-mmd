import type { BufferGeometry, LoadingManager, Material } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  AddOperation,
  Color,
  CustomBlending,
  DefaultLoadingManager,
  DoubleSide,
  DstAlphaFactor,
  FrontSide,
  MultiplyOperation,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { TGALoader } from 'three/addons/loaders/TGALoader.js'

import type { MaterialBuilderParameters, RenderStyleApplier, RenderStyleName, TextureContext } from '../material/types'

import { MMDToonMaterial } from '../material/default/mmd-toon-material'
import { checkImageTransparency, loadTextureResource } from '../material/utils'

export const mapPmxToParams = (
  material: PmxObject.Material,
  pmxTextures: readonly string[],
  geometry: BufferGeometry,
  ctx: TextureContext,
  groupIndex: number,
): MaterialBuilderParameters => {
  // eslint-disable-next-line ts/no-unsafe-assignment
  const params: MaterialBuilderParameters = { userData: { MMD: {} } } as any

  params.name = material.name
  params.diffuse = new Color().setRGB(
    material.diffuse[0],
    material.diffuse[1],
    material.diffuse[2],
    SRGBColorSpace,
  )
  params.opacity = material.diffuse[3]
  params.specular = new Color().setRGB(...material.specular, SRGBColorSpace)
  params.shininess = material.shininess
  params.emissive = new Color().setRGB(...material.ambient, SRGBColorSpace)
  params.transparent = params.opacity !== 1.0
  params.fog = true

  params.blending = CustomBlending
  params.blendSrc = SrcAlphaFactor
  params.blendDst = OneMinusSrcAlphaFactor
  params.blendSrcAlpha = SrcAlphaFactor
  params.blendDstAlpha = DstAlphaFactor

  if ((material.flag & PmxObject.Material.Flag.IsDoubleSided) === 1) {
    params.side = DoubleSide
  }
  else {
    params.side = params.opacity === 1.0 ? FrontSide : DoubleSide
  }

  if (material.textureIndex !== -1) {
    params.map = loadTextureResource(pmxTextures[material.textureIndex], ctx)
    params.userData.MMD.mapFileName = pmxTextures[material.textureIndex]
  }

  if (
    material.sphereTextureIndex !== -1
    && (
      material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
      || material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Add
    )
  ) {
    params.matcap = loadTextureResource(
      pmxTextures[material.sphereTextureIndex],
      ctx,
    )
    params.userData.MMD.matcapFileName = pmxTextures[material.sphereTextureIndex]
    params.matcapCombine = material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
      ? MultiplyOperation
      : AddOperation
  }

  let isDefaultToon, toonFileName
  if (material.isSharedToonTexture || material.toonTextureIndex === -1) {
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    toonFileName = `toon${(`0${material.toonTextureIndex + 1}`).slice(-2)}.bmp`
    isDefaultToon = true
  }
  else {
    toonFileName = pmxTextures[material.toonTextureIndex]
    isDefaultToon = false
  }

  params.gradientMap = loadTextureResource(
    toonFileName,
    ctx,
    {
      isDefaultToonTexture: isDefaultToon,
      isToonTexture: true,
    },
  )

  params.userData.outlineParameters = {
    alpha: material.edgeColor[3],
    color: material.edgeColor.slice(0, 3),
    thickness: material.edgeSize / 300,
    visible: (material.flag & PmxObject.Material.Flag.EnabledToonEdge) !== 0 && material.edgeSize > 0.0,
  }

  if (params.map !== undefined) {
    if (!params.transparent)
      checkImageTransparency(params.map, geometry, groupIndex)

    params.emissive.multiplyScalar(0.2)
  }

  return params
}

export const createMMDMaterial = (params: MaterialBuilderParameters): MMDToonMaterial => {
  return new MMDToonMaterial(params)
}

export const applyMorphTransparencyFix = (materials: Material[], morphs: readonly PmxObject.Morph[]) => {
  const checkAlphaMorph = (elements: PmxObject.Morph.MaterialMorph['elements'], targetMaterials: Material[]) => {
    for (let i = 0, il = elements.length; i < il; i++) {
      const element = elements[i]
      if (element.index === -1)
        continue

      const material = targetMaterials[element.index]
      if (material.opacity !== element.diffuse[3])
        material.transparent = true
    }
  }

  for (let i = 0, il = morphs.length; i < il; i++) {
    const morph = morphs[i]

    if (morph.type === PmxObject.Morph.Type.GroupMorph) {
      for (let j = 0, jl = morph.indices.length; j < jl; j++) {
        const morph2 = morphs[morph.indices[j]]
        if (morph2.type !== PmxObject.Morph.Type.MaterialMorph)
          continue

        checkAlphaMorph(morph2.elements, materials)
      }
    }
    else if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
      checkAlphaMorph(morph.elements, materials)
    }
  }
}

const renderStyleRegistry = new Map<RenderStyleName, RenderStyleApplier>()
const getRenderStyleRegistry = () => {
  if (renderStyleRegistry.size === 0) {
    renderStyleRegistry.set('default', (params: MaterialBuilderParameters): MMDToonMaterial => {
      return createMMDMaterial(params)
    })
  }
  return renderStyleRegistry
}

// Possible future feature: let the user register the render style
// export const registerRenderStyle = (name, fn) => { renderStyleRegistry.set(name, fn) }

export const buildMaterial = (
  data: PmxObject,
  geometry: BufferGeometry,
  resourcePath: string,
  renderStyle: RenderStyleName = 'default',
  onProgress?: (event: ProgressEvent) => void,
  onError?: (event: unknown) => void,
) => {
  const manager: LoadingManager = DefaultLoadingManager
  const textureLoader = new TextureLoader(manager)
  textureLoader.setCrossOrigin('anonymous')

  let tgaLoader: TGALoader | undefined
  const getTGALoader = (): TGALoader => {
    if (tgaLoader === undefined)
      tgaLoader = new TGALoader(manager)
    return tgaLoader
  }

  const ctx: TextureContext = {
    getTGALoader,
    manager,
    onError,
    onProgress,
    resourcePath,
    textureLoader,
    textures: {},
  }

  const materials: MMDToonMaterial[] = []
  const registry = getRenderStyleRegistry()
  const setMaterial = registry.get(renderStyle) ?? registry.get('default')!

  for (let i = 0; i < data.materials.length; i++) {
    const pmxMaterial = data.materials[i]
    const params = mapPmxToParams(pmxMaterial, data.textures, geometry, ctx, i)
    // Apply different render styles
    materials.push(setMaterial(params))
  }

  applyMorphTransparencyFix(materials, data.morphs)
  return materials
}
