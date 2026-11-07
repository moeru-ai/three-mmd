import type { MMDMaterial, MMDMaterialEvaluatedState, MMDMaterialParameters } from '../types'

import { MeshPhysicalMaterial } from 'three'

import { copyMMDAlpha, updateMMDAlpha } from '../alpha'
import { installSdefPatch } from '../sdef'

/**
 * Engineering approximation from a Blinn-Phong exponent to Three's GGX
 * roughness input. This is intentionally not a PMX rule.
 */
const shininessToRoughness = (shininess: number): number => (
  Math.min(1, Math.sqrt(2 / (Math.max(0, shininess) + 2)))
)

/**
 * @experimental
 * Physically based MMD material that keeps Three's native lights and
 * environment lighting. PMX shininess is approximated as `roughness`;
 * `ambient`, `specular`, toon and sphere textures are not supported.
 */
export class MMDPhysicalMaterial extends MeshPhysicalMaterial implements MMDMaterial {
  public alphaMorph = false
  public readonly isMMDMaterial = true as const
  public readonly isMMDPhysicalMaterial = true
  public textureAlphaMode: MMDMaterial['textureAlphaMode'] = null

  public constructor(parameters: MMDMaterialParameters = {}) {
    super()

    this.metalness = 0

    const values = { ...parameters }
    if (values.shininess !== undefined)
      this.roughness = shininessToRoughness(values.shininess)

    delete values.ambient
    delete values.shininess
    delete values.specular
    delete values.sphereBlendMode
    delete values.sphereMap
    delete values.toonMap
    this.setValues(values)
    this.updateAlpha()
    installSdefPatch(this)
  }

  public applyMMDMaterialState(state: MMDMaterialEvaluatedState): void {
    this.color.copy(state.diffuse)
    this.opacity = state.opacity
    this.roughness = shininessToRoughness(state.shininess)
    this.updateAlpha()
  }

  public override copy(source: this): this {
    super.copy(source)
    this.defines = { ...source.defines }
    this.needsUpdate = true
    this.alphaMorph = source.alphaMorph
    this.textureAlphaMode = source.textureAlphaMode
    copyMMDAlpha(this, source)
    this.updateAlpha()
    return this
  }

  public updateAlpha(): void {
    // Matches Babylon-MMD's PBR path, where texture cutout also blends with depth writes.
    updateMMDAlpha(this, true)
  }
}
