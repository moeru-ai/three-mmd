import type { MMDLoaderPluginFactory, PhysicsFactory } from '@moeru/three-mmd'

import { Vector3 } from 'three'

import { ensureAmmo, getAmmo } from './ammo-runtime'
import { MmdAmmoPhysicsHelper } from './mmd-ammo-physics-helper'
import { MmdAmmoPhysicsModel } from './mmd-ammo-physics-model'

export const MMDAmmoPhysics: PhysicsFactory = (mmd) => {
  const ammo = getAmmo()
  const gravity = new Vector3(0, -98, 0)
  let model = new MmdAmmoPhysicsModel(ammo, mmd)
  let scalar = mmd.scale

  const rebuild = (nextScalar: number) => {
    if (Math.abs(scalar - nextScalar) < 0.0001)
      return

    scalar = nextScalar
    model.dispose()
    model = new MmdAmmoPhysicsModel(ammo, mmd)
    model.setGravity(gravity)
  }

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
    setScalar: rebuild,
    update: delta => model.update(delta),
  }
}

export const MMDAmmoPlugin: MMDLoaderPluginFactory = () => ({
  afterBuild: async (mmd) => {
    await ensureAmmo()
    mmd.setPhysics(MMDAmmoPhysics)
  },
  name: '@moeru/three-mmd-physics-ammo',
})
