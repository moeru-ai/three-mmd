import type { Material } from 'three'

export type MMDAlphaMode = 'blend' | 'cutout' | 'evaluate' | 'mmd-depth-blend'
export interface MMDAlphaPolicyInput {
  alphaTest?: number
  mode: MMDAlphaMode
  opacity: number
  textureAlphaMode?: MMDTextureAlphaMode
  textureHasTransparency: boolean
}
export type MMDResolvedAlphaMode = 'opaque' | Exclude<MMDAlphaMode, 'evaluate'>

export type MMDTextureAlphaMode = 'blend' | 'cutout'

/** Resolves renderer-neutral MMD alpha intent into one concrete render mode. */
export const resolveMMDAlphaPolicy = (input: MMDAlphaPolicyInput): MMDResolvedAlphaMode => {
  if (input.mode !== 'evaluate')
    return input.mode
  if ((input.alphaTest ?? 0) > 0)
    return 'cutout'
  if (input.opacity < 1)
    return 'blend'
  if (input.textureAlphaMode !== undefined)
    return input.textureAlphaMode
  if (input.textureHasTransparency)
    return 'blend'
  return 'opaque'
}

/**
 * Classifies sampled texture alpha using Babylon-MMD's alpha evaluation rule.
 * The input values use the usual texture-alpha range (0 = transparent,
 * 255 = opaque); Babylon's checker evaluates the inverted value in its pass.
 */
export const resolveMMDTextureAlphaMode = (
  alphaValues: readonly number[],
  alphaThreshold = 195,
  alphaBlendThreshold = 100,
): MMDTextureAlphaMode | undefined => {
  let maxInvertedAlpha = 0
  let middleInvertedAlphaSum = 0
  let middleInvertedAlphaCount = 0

  for (const alpha of alphaValues) {
    const invertedAlpha = 255 - alpha
    maxInvertedAlpha = Math.max(maxInvertedAlpha, invertedAlpha)
    if (invertedAlpha > 0 && invertedAlpha < 255) {
      middleInvertedAlphaSum += invertedAlpha
      middleInvertedAlphaCount++
    }
  }

  if (maxInvertedAlpha < alphaThreshold)
    return undefined

  const averageMiddleInvertedAlpha = middleInvertedAlphaCount === 0
    ? 0
    : middleInvertedAlphaSum / middleInvertedAlphaCount
  return averageMiddleInvertedAlpha + alphaBlendThreshold < maxInvertedAlpha
    ? 'cutout'
    : 'blend'
}

/** Applies one resolved policy to Three's alpha/depth material controls. */
export const applyMMDAlphaPolicy = (
  material: Material,
  mode: MMDResolvedAlphaMode,
  alphaTest = 0.5,
): void => {
  material.alphaTest = mode === 'cutout' ? alphaTest : 0
  material.transparent = mode === 'blend' || mode === 'mmd-depth-blend'
  material.depthWrite = mode !== 'blend'
}
