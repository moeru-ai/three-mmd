import type { Color, ColorRepresentation, Material, MeshPhongMaterialParameters, Texture, Vector4 } from 'three'

export interface MMDMaterial extends Material {
  /** Set when a material morph can change opacity. Call `updateAlpha()` afterwards. */
  alphaMorph: boolean
  applyMMDMaterialState: (state: MMDMaterialEvaluatedState) => void
  readonly isMMDMaterial: true
  /** Set once the diffuse texture alpha has been analyzed. Call `updateAlpha()` afterwards. */
  textureAlphaMode: MMDTextureAlphaMode | null
  /** Re-derives `transparent` and `alphaTest` from `opacity` and the texture alpha. */
  updateAlpha: () => void
}

export type MMDMaterialConstructor = new (parameters?: MMDMaterialParameters) => MMDMaterial

export interface MMDMaterialEvaluatedState {
  ambient: Color
  diffuse: Color
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

/**
 * Parameters shared by every MMD material. Backends ignore what they can't
 * represent, e.g. `MMDPhysicalMaterial` has no toon or sphere texture.
 */
export interface MMDMaterialParameters extends MeshPhongMaterialParameters {
  ambient?: ColorRepresentation
  sphereBlendMode?: MMDSphereBlendMode | null
  sphereMap?: null | Texture
  textureAlphaMode?: MMDTextureAlphaMode | null
  toonMap?: null | Texture
}

/** PMX sphere texture modes. */
export type MMDSphereBlendMode = 'add' | 'multiply'

/** How the diffuse texture's alpha channel should be rendered. */
export type MMDTextureAlphaMode = 'blend' | 'cutout'

export const isMMDMaterial = (material: Material): material is MMDMaterial => (
  'isMMDMaterial' in material && material.isMMDMaterial === true
)
