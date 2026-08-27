/** Precision boundary of the WebGL Physical baseline. */
export const MMD_PHYSICAL_MATERIAL_MAPPING = {
  ambient: 'unsupported',
  diffuse: 'exact',
  diffuseTexture: 'exact',
  metalness: 'unsupported',
  opacity: 'approximate',
  outline: 'unsupported',
  shininess: 'approximate',
  specular: 'approximate',
  sphereTexture: 'unsupported',
  textureMorphColor: 'unsupported',
  toonTexture: 'unsupported',
} as const

/**
 * Engineering approximation from a Blinn-Phong exponent to Three's GGX
 * roughness input. This is intentionally replaceable rather than a PMX rule.
 */
export const mmdShininessToRoughness = (shininess: number): number => (
  Math.sqrt(2 / (Math.max(0, shininess) + 2))
)

export type MMDShininessToRoughness = (shininess: number) => number

export const resolveMMDPhysicalRoughness = (
  shininess: number,
  mapping: MMDShininessToRoughness = mmdShininessToRoughness,
): number => Math.min(1, Math.max(0, mapping(shininess)))
