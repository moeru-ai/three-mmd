import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager } from 'three'

import type { PhysicsFactory } from '../physics/physics-service'
import type { MMD } from '../utils/mmd'

export interface MMDLoaderParser {
  readonly manager: LoadingManager
  readonly resourcePath: string
}

export interface MMDLoaderPlugin {
  afterBuild?: (mmd: MMD) => Promise<void> | void
  afterParse?: (pmx: PmxObject) => PmxObject | Promise<PmxObject | void> | void
  name: string
}

export type MMDLoaderPluginFactory = (parser: MMDLoaderParser,) => MMDLoaderPlugin

export const createPhysicsPlugin = (name: string, createPhysics: PhysicsFactory): MMDLoaderPluginFactory => () => ({
  afterBuild: mmd => mmd.setPhysics(createPhysics),
  name,
})
