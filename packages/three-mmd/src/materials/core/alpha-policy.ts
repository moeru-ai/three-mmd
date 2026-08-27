import type { Material, Texture } from 'three'

const transparentTextures = new WeakSet<Texture>()
const transparencyListeners = new WeakMap<Texture, Set<() => void>>()

export type MMDAlphaMode = 'blend' | 'cutout' | 'evaluate' | 'mmd-depth-blend'
export interface MMDAlphaPolicyInput {
  alphaTest?: number
  mode: MMDAlphaMode
  opacity: number
  textureHasTransparency: boolean
}

export type MMDResolvedAlphaMode = 'opaque' | Exclude<MMDAlphaMode, 'evaluate'>

/** Resolves renderer-neutral MMD alpha intent into one concrete render mode. */
export const resolveMMDAlphaPolicy = (input: MMDAlphaPolicyInput): MMDResolvedAlphaMode => {
  if (input.mode !== 'evaluate')
    return input.mode
  if ((input.alphaTest ?? 0) > 0)
    return 'cutout'
  if (input.opacity < 1 || input.textureHasTransparency)
    return 'blend'
  return 'opaque'
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

/** Records a loader alpha evaluation and notifies material bindings. */
export const markMMDTextureTransparent = (texture: Texture): void => {
  if (transparentTextures.has(texture))
    return

  transparentTextures.add(texture)
  for (const listener of transparencyListeners.get(texture) ?? [])
    listener()
}

/** Subscribes a material binding to asynchronous loader alpha evaluation. */
export const onMMDTextureTransparency = (texture: Texture, listener: () => void): (() => void) => {
  let listeners = transparencyListeners.get(texture)
  if (listeners === undefined) {
    listeners = new Set()
    transparencyListeners.set(texture, listeners)
  }
  listeners.add(listener)
  if (transparentTextures.has(texture))
    listener()

  return () => listeners.delete(listener)
}
