import type { MMDMaterial } from './types'

const automaticAlphaTest = 0.5

/** Materials whose current `alphaTest` was derived here rather than set by the user. */
const derivedAlphaTest = new WeakSet<MMDMaterial>()

/**
 * Resolves MMD's alpha rules into Three's material flags. Translucent
 * materials keep writing depth, as MMD does, so `depthWrite` stays on.
 * A user-set `alphaTest` always wins and keeps its threshold as a cutout.
 *
 * @param material The material to update.
 * @param cutoutAsBlend Render texture cutout as depth-writing blend instead of alpha test.
 */
export const updateMMDAlpha = (material: MMDMaterial, cutoutAsBlend = false): void => {
  if (material.alphaTest > 0 && !derivedAlphaTest.has(material)) {
    material.transparent = false
    return
  }

  const { alphaMorph, opacity, textureAlphaMode } = material

  const cutout = opacity === 1 && textureAlphaMode === 'cutout' && !cutoutAsBlend
  const blend = !cutout && (opacity < 1 || textureAlphaMode !== null || alphaMorph)

  material.alphaTest = cutout ? automaticAlphaTest : 0
  material.transparent = blend
  if (cutout)
    derivedAlphaTest.add(material)
  else
    derivedAlphaTest.delete(material)
}

/** Carries the "derived vs. user-set" `alphaTest` state across `Material.copy()`. */
export const copyMMDAlpha = (target: MMDMaterial, source: MMDMaterial): void => {
  if (derivedAlphaTest.has(source))
    derivedAlphaTest.add(target)
  else
    derivedAlphaTest.delete(target)
}
