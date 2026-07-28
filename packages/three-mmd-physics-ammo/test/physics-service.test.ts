import type { MMD } from '@moeru/three-mmd'

import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MMDAmmoPhysics } from '../src'

const mocks = vi.hoisted(() => ({
  setGravity: vi.fn(),
}))

vi.mock('../src/mmd-physics', () => ({
  MMDPhysics: class {
    createHelper = vi.fn()
    reset = vi.fn()
    setGravity = mocks.setGravity
    update = vi.fn()
    warmup = vi.fn()
  },
}))

describe('mmd Ammo physics', () => {
  it('forwards gravity changes to the Ammo physics implementation', () => {
    const mmd = {
      mesh: {},
      pmx: {
        joints: [],
        rigidBodies: [],
      },
    } as MMD
    const gravity = new Vector3(1, -98, 2)
    const physics = MMDAmmoPhysics(mmd)

    physics.setGravity?.(gravity)

    expect(mocks.setGravity).toHaveBeenCalledWith(gravity)
  })
})
