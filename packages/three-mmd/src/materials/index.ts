export {
  type MMDAlphaMode,
  type MMDAlphaPolicyInput,
  type MMDResolvedAlphaMode,
  resolveMMDAlphaPolicy,
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
