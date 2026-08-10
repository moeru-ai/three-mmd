import { describe, expect, it, vi } from 'vitest'

import { AmmoWorld } from '../src/ammo-world'

describe('ammoWorld', () => {
  it('uses the stable MMD fixed step', () => {
    const stepSimulation = vi.fn()
    class EmptyResource {}
    class TestWorld {
      public readonly setGravity = vi.fn()
      public readonly stepSimulation = stepSimulation
    }
    const ammo = {
      btCollisionDispatcher: EmptyResource,
      btDbvtBroadphase: EmptyResource,
      btDefaultCollisionConfiguration: EmptyResource,
      btDiscreteDynamicsWorld: TestWorld,
      btSequentialImpulseConstraintSolver: EmptyResource,
      btVector3: EmptyResource,
      destroy: vi.fn(),
    }

    const world = new AmmoWorld(ammo as never)
    world.step(0.25)

    expect(stepSimulation).toHaveBeenCalledWith(0.25, 5, 1 / 65)
  })
})
