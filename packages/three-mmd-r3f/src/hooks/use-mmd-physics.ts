import type { MMD, PhysicsFactory } from '@moeru/three-mmd'

import { useFrame } from '@react-three/fiber'
import { startTransition, useEffect, useState } from 'react'

export const useMMDPhysics = <T>(mmd: MMD, createPhysics: PhysicsFactory<T>, paused = false): T | undefined => {
  const [helper, setHelper] = useState<T>()

  useEffect(() => {
    mmd.setPhysics(createPhysics)
    startTransition(() => setHelper(mmd.createHelper() as T))

    return () => {
      mmd.physics?.dispose?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPhysics])

  useFrame((_, delta) => {
    if (paused)
      return

    // Only update physics calculation after the scale setting was done
    mmd.update(delta)
  })

  return helper
}
