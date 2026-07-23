import type { PhysicsFactory } from '@moeru/three-mmd'

import { createPhysicsPlugin } from '@moeru/three-mmd'

import { name } from '../package.json'
import { MMDPhysics } from './mmd-physics'

export const MMDAmmoPhysics: PhysicsFactory = (mmd) => {
  const physicsRigidBodyBoneIndices = new Set(
    mmd.pmx.rigidBodies
      .filter(body => body.physicsMode > 0 && body.boneIndex >= 0)
      .map(body => body.boneIndex),
  )
  const ikLinkStates = mmd.iks
    .flatMap(ik => ik.links)
    .filter(link => physicsRigidBodyBoneIndices.has(link.index))
    .map(link => ({ enabled: link.enabled, link }))

  for (const { link } of ikLinkStates)
    link.enabled = false

  const physics = new MMDPhysics(
    mmd.mesh,
    mmd.pmx.rigidBodies,
    mmd.pmx.joints,
  )

  physics.warmup(60)

  return {
    createHelper: <T>() => physics.createHelper() as T,
    dispose: () => {
      ikLinkStates.forEach(({ enabled, link }) => {
        link.enabled = enabled
      })
    },
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
