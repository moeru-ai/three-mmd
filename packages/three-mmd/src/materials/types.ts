import type { Color, Material, MaterialParameters, Texture, Vector4 } from 'three'

import type { MMDToonMaterial } from './toon/mmd-toon-material'

export interface MMDMaterial extends Material {
  applyMMDMaterialState: (state: MMDMaterialEvaluatedState) => void
  readonly descriptor: MMDMaterialDescriptor
  readonly isMMDMaterial: true
  readonly mmdCapabilities: MMDMaterialCapabilities
}

export interface MMDMaterialCapabilities {
  readonly materialMorph: 'binding'
  readonly outline: true
  readonly renderer: readonly ('webgl-renderer')[]
  readonly sdef: 'full'
  readonly sphereTexture: readonly MMDSphereBlendMode[]
  readonly toon: boolean
}

export type MMDMaterialConstructor = new (descriptor: MMDMaterialDescriptor) => MMDToonMaterial

/**
 * Normalized PMX material data plus the textures resolved by the loader.
 *
 * This deliberately describes MMD semantics instead of renderer-specific
 * aliases such as `gradientMap` and `matcap`.
 */
export interface MMDMaterialDescriptor extends MaterialParameters {
  ambient: Color
  diffuse: Color
  fog: boolean
  isDefaultToonTexture: boolean
  map?: Texture
  mapFileName?: string
  name: string
  opacity: number
  outline: MMDOutlineDescriptor
  shininess: number
  specular: Color
  sphereBlendMode?: MMDSphereBlendMode
  sphereMap?: Texture
  sphereMapFileName?: string
  toonMap: Texture
  toonMapFileName: string
  transparent: boolean
}

export interface MMDMaterialEvaluatedState {
  ambient: Color
  diffuse: Color
  edgeAlpha: number
  edgeColor: Color
  edgeWidth: number
  opacity: number
  shininess: number
  specular: Color
  sphereTextureAdditiveColor: Vector4
  sphereTextureMultiplicativeColor: Vector4
  textureAdditiveColor: Vector4
  textureMultiplicativeColor: Vector4
  toonTextureAdditiveColor: Vector4
  toonTextureMultiplicativeColor: Vector4
}

export interface MMDOutlineDescriptor {
  alpha: number
  color: Color
  visible: boolean
  width: number
}

/** PMX sphere modes implemented by the classic MMD material backend. */
export type MMDSphereBlendMode = 'add' | 'multiply'
