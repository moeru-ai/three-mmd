import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager } from 'three'

import type { MMDMaterialConstructor } from '../materials/types'
import type { PhysicsFactory } from '../physics/physics-service'
import type { MMD } from '../utils/mmd'

export interface MMDLoaderParser {
  readonly manager: LoadingManager
  readonly resourcePath: string
}

export interface MMDLoaderPlugin {
  afterBuild?: (mmd: MMD) => Promise<void> | void
  afterParse?: (pmx: PmxObject) => PmxObject | Promise<PmxObject | void> | void
  materialType?: MMDMaterialConstructor
  name: string
}

export type MMDLoaderPluginFactory = (parser: MMDLoaderParser) => MMDLoaderPlugin

export interface MMDMaterialPluginOptions {
  materialType: MMDMaterialConstructor
}

const isFirstPartyMaterial = (materialType: MMDMaterialConstructor): boolean => (
  materialType.isMMDMaterial === true
)

/** Selects the first-party MMD material backend before mesh assembly begins. */
export class MMDMaterialPlugin implements MMDLoaderPlugin {
  public readonly materialType: MMDMaterialConstructor
  public readonly name = 'MMDMaterialPlugin'

  public constructor(_parser: MMDLoaderParser, options: MMDMaterialPluginOptions) {
    if (!isFirstPartyMaterial(options.materialType)) {
      throw new TypeError(
        'MMDMaterialPlugin: materialType must be an MMD material backend.',
      )
    }
    this.materialType = options.materialType
  }
}

export const createPhysicsPlugin = (name: string, createPhysics: PhysicsFactory): MMDLoaderPluginFactory => () => ({
  afterBuild: mmd => mmd.setPhysics(createPhysics),
  name,
})
