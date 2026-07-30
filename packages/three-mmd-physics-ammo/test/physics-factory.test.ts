import { MMD } from '@moeru/three-mmd'
import { Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as packageExports from '../src'

const mocks = vi.hoisted(() => {
  const instances: Array<{
    dispose: ReturnType<typeof vi.fn>
    initialize: ReturnType<typeof vi.fn>
    setGravity: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }> = []

  return {
    ensureAmmo: vi.fn(async () => ({ initialized: true })),
    getAmmo: vi.fn(() => ({ initialized: true })),
    instances,
    setPhysics: vi.fn(),
  }
})

vi.mock('../src/ammo-runtime', () => ({
  ensureAmmo: mocks.ensureAmmo,
  getAmmo: mocks.getAmmo,
}))

vi.mock('../src/mmd-ammo-physics-model', () => ({
  MmdAmmoPhysicsModel: class {
    public readonly dispose = vi.fn()
    public readonly initialize = vi.fn()
    public readonly setGravity = vi.fn()
    public readonly update = vi.fn()

    public constructor() {
      mocks.instances.push(this)
    }
  },
}))

vi.mock('../src/mmd-ammo-physics-helper', () => ({
  MmdAmmoPhysicsHelper: class {},
}))

const createMMD = (): MMD => Object.assign(
  Object.create(MMD.prototype) as MMD,
  {
    mesh: {},
    pmx: {
      rigidBodies: [],
    },
    scale: 1,
    setPhysics: mocks.setPhysics,
  },
)

describe('ammo physics package', () => {
  beforeEach(() => {
    mocks.ensureAmmo.mockClear()
    mocks.getAmmo.mockClear()
    mocks.instances.length = 0
    mocks.setPhysics.mockClear()
  })

  it('only exports the physics factory and loader plugin', () => {
    expect(Object.keys(packageExports).sort((a, b) => a.localeCompare(b))).toEqual([
      'MMDAmmoPhysics',
      'MMDAmmoPlugin',
    ])
  })

  it('forwards the physics lifecycle and rebuilds when model scale changes', () => {
    const mmd = createMMD()
    const physics = packageExports.MMDAmmoPhysics(mmd)
    const firstModel = mocks.instances[0]
    const gravity = new Vector3(1, -98, 2)

    physics.reset?.()
    physics.setGravity?.(gravity)
    physics.update(1 / 60)

    expect(firstModel.initialize).toHaveBeenCalledOnce()
    expect(firstModel.setGravity).toHaveBeenCalledWith(gravity)
    expect(firstModel.update).toHaveBeenCalledWith(1 / 60)

    physics.setScalar?.(1)
    expect(mocks.instances).toHaveLength(1)

    mmd.scale = 0.1
    physics.setScalar?.(0.1)
    expect(firstModel.dispose).toHaveBeenCalledOnce()
    expect(mocks.instances).toHaveLength(2)
    expect(mocks.instances[1].setGravity).toHaveBeenCalledWith(gravity)

    physics.dispose?.()
    expect(mocks.instances[1].dispose).toHaveBeenCalledOnce()
  })

  it('waits for Ammo before installing physics through the loader plugin', async () => {
    const mmd = createMMD()
    const plugin = packageExports.MMDAmmoPlugin({} as never)

    await plugin.afterBuild?.(mmd)

    expect(mocks.ensureAmmo).toHaveBeenCalledOnce()
    expect(mocks.setPhysics).toHaveBeenCalledWith(packageExports.MMDAmmoPhysics)
  })
})
