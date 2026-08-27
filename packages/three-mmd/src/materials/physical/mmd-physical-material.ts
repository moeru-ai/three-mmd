import type { MeshPhysicalMaterialParameters, Texture } from 'three'

import type { MMDAlphaMode } from '../core/alpha-policy'
import type {
  MMDMaterialCapabilities,
  MMDMaterialDescriptor,
  MMDMaterialEvaluatedState,
} from '../types'
import type { MMDPhysicalSpecularMode, MMDShininessToRoughness } from './mapping'

import { MeshPhysicalMaterial } from 'three'

import {
  applyMMDAlphaPolicy,
  onMMDTextureTransparency,
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
    ...(descriptor.blendDst === undefined ? {} : { blendDst: descriptor.blendDst }),
    ...(descriptor.blendDstAlpha === undefined ? {} : { blendDstAlpha: descriptor.blendDstAlpha }),
    ...(descriptor.blending === undefined ? {} : { blending: descriptor.blending }),
    ...(descriptor.blendSrc === undefined ? {} : { blendSrc: descriptor.blendSrc }),
    ...(descriptor.blendSrcAlpha === undefined ? {} : { blendSrcAlpha: descriptor.blendSrcAlpha }),
    ...(descriptor.map === undefined ? {} : { map: descriptor.map }),
    ...(descriptor.side === undefined ? {} : { side: descriptor.side }),
    color: descriptor.diffuse,
    fog: descriptor.fog,
    metalness: 0,
    opacity: descriptor.opacity,
    roughness: resolveMMDPhysicalRoughness(descriptor.shininess, options.shininessToRoughness),
    ...(specularColor === undefined ? {} : { specularColor }),
    transparent: descriptor.transparent,
  }
}

/** Opt-in physically based MMD material backend for WebGLRenderer. */
export class MMDPhysicalMaterial extends MeshPhysicalMaterial {
  public static readonly isMMDMaterial = true as const

  public alphaMode: MMDAlphaMode
  public descriptor: MMDMaterialDescriptor
  public readonly isMMDMaterial = true as const
  public readonly mmdCapabilities = capabilities
  public shininessToRoughness: MMDShininessToRoughness
  public specularMode: MMDPhysicalSpecularMode
  private alphaMorphEnabled = false
  private stopTextureTransparencyWatch?: () => void
  private textureHasTransparency = false

  public constructor(descriptor: MMDMaterialDescriptor, options: MMDPhysicalMaterialOptions = {}) {
    const resolvedOptions = resolveOptions(options)
    super(createPhysicalParameters(descriptor, resolvedOptions))
    this.descriptor = descriptor
    this.alphaMode = resolvedOptions.alphaMode
    this.shininessToRoughness = resolvedOptions.shininessToRoughness
    this.specularMode = resolvedOptions.specularMode
    this.name = descriptor.name
    this.updateAlphaPolicy(descriptor.opacity, false)
    this.watchDiffuseMap(descriptor.map)
    installSdefPatch(this)
  }

  public applyMMDMaterialState(state: MMDMaterialEvaluatedState): void {
    this.color.copy(state.diffuse)
    this.opacity = state.opacity
    this.roughness = resolveMMDPhysicalRoughness(state.shininess, this.shininessToRoughness)
    const specularColor = resolveMMDPhysicalSpecularColor(state.specular, this.specularMode)
    if (specularColor !== undefined)
      this.specularColor.copy(specularColor)
    this.updateAlphaPolicy(state.opacity, this.textureHasTransparency)
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
    this.textureHasTransparency = source.textureHasTransparency
    this.watchDiffuseMap(source.map)
    return this
  }

  public override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}|mmd-physical|sdef:${String(this.defines?.MMD_USE_SDEF ?? 1)}`
  }

  public setMMDAlphaMorphEnabled(enabled: boolean): void {
    this.alphaMorphEnabled = enabled
    this.updateAlphaPolicy(this.opacity, this.textureHasTransparency)
  }

  public setSdefEnabled(enabled: boolean): void {
    const value = enabled ? 1 : 0
    if (this.defines?.MMD_USE_SDEF === value)
      return

    this.defines = { ...this.defines, MMD_USE_SDEF: value }
    this.needsUpdate = true
  }

  private updateAlphaPolicy(opacity: number, textureHasTransparency: boolean): void {
    const mode = resolveMMDAlphaPolicy({
      alphaTest: this.descriptor.alphaTest,
      mode: this.alphaMode,
      opacity,
      textureHasTransparency: textureHasTransparency || this.alphaMorphEnabled,
    })
    applyMMDAlphaPolicy(this, mode, this.descriptor.alphaTest ?? 0.5)
  }

  private watchDiffuseMap(map: null | Texture | undefined): void {
    this.stopTextureTransparencyWatch?.()
    this.stopTextureTransparencyWatch = undefined
    if (map === null || map === undefined)
      return

    this.stopTextureTransparencyWatch = onMMDTextureTransparency(map, () => {
      this.textureHasTransparency = true
      this.updateAlphaPolicy(this.opacity, true)
    })
  }
}
