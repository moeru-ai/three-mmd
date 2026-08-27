export {
  applyMMDAlphaPolicy,
  getMMDTextureAlphaMode,
  markMMDTextureTransparent,
  type MMDAlphaMode,
  type MMDAlphaPolicyInput,
  type MMDResolvedAlphaMode,
  type MMDTextureAlphaMode,
  resolveMMDAlphaPolicy,
  resolveMMDTextureAlphaMode,
} from './core/alpha-policy'
export { applyMMDMaterialMorph, createMMDMaterialEvaluatedState } from './morph'
export { isMMDMaterial } from './types'
export type {
  MMDMaterial,
  MMDMaterialCapabilities,
  MMDMaterialConstructor,
  MMDMaterialDescriptor,
  MMDMaterialEvaluatedState,
  MMDOutlineDescriptor,
  MMDSphereBlendMode,
} from './types'
