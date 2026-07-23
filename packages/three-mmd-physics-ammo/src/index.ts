import type { PhysicsFactory } from '@moeru/three-mmd'

import { createPhysicsPlugin } from '@moeru/three-mmd'

import { name } from '../package.json'
import { MMDPhysics } from './mmd-physics'

export const MMDAmmoPhysics: PhysicsFactory = (mmd) => {
  const physics = new MMDPhysics(
    mmd.mesh,
    mmd.pmx.rigidBodies,
    mmd.pmx.joints,
  )

  physics.warmup(60)

  return {
    createHelper: <T>() => physics.createHelper() as T,
    reset: () => physics.reset(),
    update: (delta: number) => physics.update(delta),
  }
}

export const MMDAmmoPlugin = createPhysicsPlugin(
  name,
  MMDAmmoPhysics,
)

export { initAmmo } from './init'
export { MMDPhysicsHelper } from './mmd-physics-helper'
