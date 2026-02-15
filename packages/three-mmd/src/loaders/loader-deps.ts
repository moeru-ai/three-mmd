/**
 * Shared dependency map for assembling MMD models.
 * Plugins can override any step (parse, post-process, geometry, materials, bones, IK, grants, mesh creation)
 * by returning Partial<MMDLoaderDeps> and letting resolveDeps merge overrides on top of defaults.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { BufferGeometry, SkinnedMesh, LoadingManager } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import type { MMDToonMaterial } from '../materials/mmd-toon-material'
import type { Grant } from '../utils/build-grants'

import { buildBones } from '../utils/build-bones'
import { buildGeometry } from '../utils/build-geometry'
import { buildGrants } from '../utils/build-grants'
import { buildIK } from '../utils/build-ik'
import { buildMaterial } from '../utils/build-material'
import { buildMesh } from '../utils/build-mesh'
import { postParseProcessing } from '../utils/post-parse'

export interface MMDLoaderDeps {
  buildBones: (pmx: PmxObject, mesh: SkinnedMesh) => SkinnedMesh
  buildGeometry: (pmx: PmxObject) => BufferGeometry
  buildGrants: (pmx: PmxObject) => Grant[]
  buildIK: (pmx: PmxObject) => IK[]
  buildMaterials: (pmx: PmxObject, geo: BufferGeometry, rp: string, manager?: LoadingManager) => MMDToonMaterial[]
  buildMesh: (geometry: BufferGeometry, materials: MMDToonMaterial[]) => SkinnedMesh
  postParseProcessing: (pmx: PmxObject) => PmxObject
}

export const defaultDeps: Required<MMDLoaderDeps> = {
  buildBones,
  buildGeometry,
  buildGrants,
  buildIK,
  buildMaterials: (pmx, geo, rp, manager) => buildMaterial(pmx, geo, rp, undefined, undefined, undefined, manager),
  buildMesh,
  postParseProcessing,
}

// Plugin register
export type MMDLoaderPlugin = (deps: MMDLoaderDeps) => Partial<MMDLoaderDeps>
export const resolveDeps = (
  plugins: MMDLoaderPlugin[] = [],
  baseDeps: MMDLoaderDeps = defaultDeps,
): MMDLoaderDeps => {
  let mergedDeps = { ...baseDeps }
  plugins.forEach((p) => {
    mergedDeps = { ...mergedDeps, ...p(mergedDeps) }
  })
  return mergedDeps
}
