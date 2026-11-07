import type { MMDMaterial } from './types'

/**
 * Resolves MMD's alpha rules into Three's material flags. Translucent
 * materials keep writing depth, as MMD does, so `depthWrite` stays on.
 *
 * @param material The material to update.
 * @param cutoutAsBlend Render texture cutout as depth-writing blend instead of alpha test.
 */
export const updateMMDAlpha = (material: MMDMaterial, cutoutAsBlend = false): void => {
  const { alphaMorph, opacity, textureAlphaMode } = material

  const cutout = opacity === 1 && textureAlphaMode === 'cutout' && !cutoutAsBlend
  const blend = !cutout && (opacity < 1 || textureAlphaMode !== null || alphaMorph)

  material.alphaTest = cutout ? 0.5 : 0
  material.transparent = blend
}
