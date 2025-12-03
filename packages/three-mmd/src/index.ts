export type { MMDLoaderPlugin } from './loaders/loader-deps'
export { MMDLoader } from './loaders/mmd-loader'
export { MMDMeshLoader } from './loaders/mmd-mesh-loader'
export { VMDLoader } from './loaders/vmd-loader'

export { GrantSolver } from './physics/grant-solver'
export { processBones } from './physics/process-bones'

export { buildAnimation, buildCameraAnimation } from './utils/build-animation'
export { buildBones } from './utils/build-bones'
export { buildGeometry } from './utils/build-geometry'
export { buildGrants, type Grant } from './utils/build-grants'
export { buildIK } from './utils/build-ik'
export { buildMaterial } from './utils/build-material'
export { buildMesh } from './utils/build-mesh'
export type { BuildPhysicsOptions, PhysicsStrategy } from './utils/build-physics'
export { MMD } from './utils/mmd'

export { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
