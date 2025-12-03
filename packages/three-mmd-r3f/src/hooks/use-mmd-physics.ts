import type { MMD, PhysicsFactory } from '@moeru/three-mmd'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

export const useMMDPhysics = <T>(mmd: MMD, createPhysics: PhysicsFactory<T>): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => mmd.setPhysics(createPhysics), [createPhysics])

  useFrame((_, delta) => mmd.update(delta))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => mmd.createHelper() as T, [createPhysics])
}
