import type { MeshPhysicalMaterialParameters } from 'three'

import type { MMDAlphaMode, MMDTextureAlphaMode } from '../core/alpha-policy'
import type {
  MMDMaterialCapabilities,
  MMDMaterialDescriptor,
  MMDMaterialEvaluatedState,
} from '../types'
import type { MMDPhysicalSpecularMode, MMDShininessToRoughness } from './mapping'

import { DoubleSide, FrontSide, MeshPhysicalMaterial } from 'three'

import {
  applyMMDAlphaPolicy,
  resolveMMDAlphaPolicy,
} from '../core/alpha-policy'
import { installSdefPatch } from '../core/sdef'
import {
  mmdShininessToRoughness,
  resolveMMDPhysicalRoughness,
  resolveMMDPhysicalSpecularColor,
} from './mapping'

export interface MMDPhysicalMaterialOptions {
  alphaMode?: MMDAlphaMode
  shininessToRoughness?: MMDShininessToRoughness
  specularMode?: MMDPhysicalSpecularMode
}

interface ResolvedMMDPhysicalMaterialOptions {
  alphaMode: MMDAlphaMode
  shininessToRoughness: MMDShininessToRoughness
  specularMode: MMDPhysicalSpecularMode
}

const capabilities: MMDMaterialCapabilities = {
  alpha: ['opaque', 'cutout', 'blend', 'mmd-depth-blend'],
  materialMorph: 'binding',
  outline: false,
  renderer: ['webgl-renderer'],
  sdef: 'full',
  sphereTexture: [],
  toon: false,
}

const resolveOptions = (options: MMDPhysicalMaterialOptions): ResolvedMMDPhysicalMaterialOptions => ({
  alphaMode: options.alphaMode ?? 'evaluate',
  shininessToRoughness: options.shininessToRoughness ?? mmdShininessToRoughness,
  specularMode: options.specularMode ?? 'ignore',
})

const createPhysicalParameters = (
  descriptor: MMDMaterialDescriptor,
  options: ResolvedMMDPhysicalMaterialOptions,
): MeshPhysicalMaterialParameters => {
  const specularColor = resolveMMDPhysicalSpecularColor(descriptor.specular, options.specularMode)
  return {
    ...(descriptor.alphaTest === undefined ? {} : { alphaTest: descriptor.alphaTest }),
    ...(descriptor.map === undefined ? {} : { map: descriptor.map }),
    color: descriptor.diffuse,
    fog: descriptor.fog,
    metalness: 0,
    opacity: descriptor.opacity,
    roughness: resolveMMDPhysicalRoughness(descriptor.shininess, options.shininessToRoughness),
    ...(specularColor === undefined ? {} : { specularColor }),
    side: descriptor.doubleSided ? DoubleSide : FrontSide,
    transparent: descriptor.opacity !== 1,
  }
}

/** Opt-in physically based MMD material backend for WebGLRenderer. */
export class MMDPhysicalMaterial extends MeshPhysicalMaterial {
  public static readonly isMMDMaterial = true as const
  public static readonly mmdCapabilities = capabilities

  public alphaMode: MMDAlphaMode
  public descriptor: MMDMaterialDescriptor
  public readonly isMMDMaterial = true as const
  public readonly mmdCapabilities = capabilities
  public shininessToRoughness: MMDShininessToRoughness
  public specularMode: MMDPhysicalSpecularMode
  private alphaMorphEnabled = false
  private textureAlphaMode?: MMDTextureAlphaMode

  public constructor(descriptor: MMDMaterialDescriptor, options: MMDPhysicalMaterialOptions = {}) {
    const resolvedOptions = resolveOptions(options)
    super(createPhysicalParameters(descriptor, resolvedOptions))
    this.descriptor = descriptor
    this.alphaMode = resolvedOptions.alphaMode
    this.shininessToRoughness = resolvedOptions.shininessToRoughness
    this.specularMode = resolvedOptions.specularMode
    this.name = descriptor.name
    this.textureAlphaMode = descriptor.textureAlphaMode
    this.updateAlphaPolicy(descriptor.opacity)
    installSdefPatch(this)
  }

  public applyMMDMaterialState(state: MMDMaterialEvaluatedState): void {
    this.color.copy(state.diffuse)
    this.opacity = state.opacity
    this.roughness = resolveMMDPhysicalRoughness(state.shininess, this.shininessToRoughness)
    const specularColor = resolveMMDPhysicalSpecularColor(state.specular, this.specularMode)
    if (specularColor !== undefined)
      this.specularColor.copy(specularColor)
    this.updateAlphaPolicy(state.opacity)
  }

  public override clone(): this {
    const Constructor = this.constructor as new (
      descriptor: MMDMaterialDescriptor,
      options?: MMDPhysicalMaterialOptions,
    ) => this
    return new Constructor(this.descriptor, {
      alphaMode: this.alphaMode,
      shininessToRoughness: this.shininessToRoughness,
      specularMode: this.specularMode,
    }).copy(this)
  }

  public override copy(source: this): this {
    super.copy(source)
    this.descriptor = source.descriptor
    this.alphaMode = source.alphaMode
    this.shininessToRoughness = source.shininessToRoughness
    this.specularMode = source.specularMode
    this.alphaMorphEnabled = source.alphaMorphEnabled
    this.textureAlphaMode = source.textureAlphaMode
    this.updateAlphaPolicy(this.opacity)
    return this
  }

  public override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}|mmd-physical|sdef:${String(this.defines?.MMD_USE_SDEF ?? 1)}`
  }

  public setMMDAlphaMorphEnabled(enabled: boolean): void {
    this.alphaMorphEnabled = enabled
    this.updateAlphaPolicy(this.opacity)
  }

  public setMMDTextureAlphaMode(mode: MMDTextureAlphaMode | undefined): void {
    this.textureAlphaMode = mode
    this.updateAlphaPolicy(this.opacity, mode)
  }

  public setSdefEnabled(enabled: boolean): void {
    const value = enabled ? 1 : 0
    if (this.defines?.MMD_USE_SDEF === value)
      return

    this.defines = { ...this.defines, MMD_USE_SDEF: value }
    this.needsUpdate = true
  }

  private updateAlphaPolicy(
    opacity: number,
    textureAlphaMode: MMDTextureAlphaMode | undefined = this.textureAlphaMode,
  ): void {
    const mode = resolveMMDAlphaPolicy({
      alphaTest: this.descriptor.alphaTest,
      mode: this.alphaMode,
      opacity,
      textureAlphaMode,
      textureHasTransparency: textureAlphaMode !== undefined || this.alphaMorphEnabled,
    })
    // Babylon-MMD's default PBR render method is
    // DepthWriteAlphaBlendingWithEvaluation. Keep the evaluated MMD path's
    // depth-writing blend so overlapping cutout/blended parts do not reveal
    // surfaces behind them. Conventional depthWrite=false blending remains
    // available through the explicit `blend` option.
    const renderMode = this.alphaMode === 'evaluate' && mode === 'blend'
      ? 'mmd-depth-blend'
      : mode
    applyMMDAlphaPolicy(this, renderMode, this.descriptor.alphaTest ?? 0.5)
  }
}
