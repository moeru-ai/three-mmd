import type { PhysicsFactory } from '@moeru/three-mmd'

import type { MMDPhysicsHelper } from './mmd-physics-helper'

import { MMDPhysics } from './mmd-physics'

export const MMDAmmoPhysics: PhysicsFactory<MMDPhysicsHelper> = (mmd) => {
  const physics = new MMDPhysics(
    mmd.mesh,
    mmd.pmx.rigidBodies,
    mmd.pmx.joints,
  )

  // physics.warmup(60)

  return {
    createHelper: () => physics.createHelper(),
    update: (delta: number) => physics.update(delta),
  }
}

export { initAmmo } from './init'
