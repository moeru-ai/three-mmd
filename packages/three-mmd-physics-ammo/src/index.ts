import type { MMDLoaderPluginFactory, PhysicsFactory } from '@moeru/three-mmd'

import { Vector3 } from 'three'

import { getAmmo } from './ammo-runtime'
import { initAmmo } from './init-ammo'
import { MmdAmmoPhysicsHelper } from './mmd-ammo-physics-helper'
import { MmdAmmoPhysicsModel } from './mmd-ammo-physics-model'

export { initAmmo } from './init-ammo'

export const MMDAmmoPhysics: PhysicsFactory = (mmd) => {
  const ammo = getAmmo()
  const gravity = new Vector3(0, -98, 0)
  const model = new MmdAmmoPhysicsModel(ammo, mmd)

  return {
    affectsIK: true,
    createHelper: <T>() => new MmdAmmoPhysicsHelper(
      mmd.pmx.rigidBodies,
      () => model,
    ) as T,
    dispose: () => model.dispose(),
    reset: () => model.initialize(),
    setGravity: (nextGravity) => {
      gravity.copy(nextGravity)
      model.setGravity(gravity)
    },
    update: delta => model.update(delta),
  }
}

export const MMDAmmoPlugin: MMDLoaderPluginFactory = () => ({
  afterBuild: async (mmd) => {
    await initAmmo()
    mmd.setPhysics(MMDAmmoPhysics)
  },
  name: '@moeru/three-mmd-physics-ammo',
})
