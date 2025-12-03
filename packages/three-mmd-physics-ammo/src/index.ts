import type { MMDLoaderPlugin } from '@moeru/three-mmd'

import { MMDPhysics } from './mmd-physics'

export const MMDAmmoPhysics: MMDLoaderPlugin = () => ({
  buildPhysics: ({ mesh, pmx }) => {
    const physics = new MMDPhysics(
      mesh,
      pmx.rigidBodies,
      pmx.joints,
    )

    // physics.warmup(60)

    return {
      createPhysicsHelpers: () => physics.createHelper(),
      name: 'ammo',
      update: (delta: number) => physics.update(delta),
    }
  },
})

export { initAmmo } from './init'
