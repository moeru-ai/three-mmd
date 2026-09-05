export {
  createPhysicsPlugin,
  type MMDLoaderParser,
  type MMDLoaderPlugin,
  type MMDLoaderPluginFactory,
  MMDMaterialPlugin,
  type MMDMaterialPluginOptions,
} from './loaders/loader-plugin'
export { MMDLoader } from './loaders/mmd-loader'
export { VMDLoader } from './loaders/vmd-loader'
export { VPDLoader } from './loaders/vpd-loader'

export { GrantSolver } from './physics/grant-solver'
export { MMDIKHelper } from './physics/mmd-ik-helper'
export { MMDIKSolver } from './physics/mmd-ik-solver'
export type { PhysicsFactory, PhysicsService } from './physics/physics-service'

export { applyVPD, type ApplyVPDOptions } from './utils/apply-vpd'
export {
  buildAnimation,
  buildCameraAnimation,
  type MMDAnimationUserData,
  type MMDPropertyTrackData,
} from './utils/build-animation'
export { MMD, type MMDUpdateOptions } from './utils/mmd'
export {
  type AudioAnimationOptions,
  MMDAnimationManager,
  type MMDAnimationOptions,
} from './utils/mmd-animation-manager'

export { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
export { VmdObject } from 'babylon-mmd/esm/Loader/Parser/vmdObject'
export type { VpdObject } from 'babylon-mmd/esm/Loader/Parser/vpdObject'
