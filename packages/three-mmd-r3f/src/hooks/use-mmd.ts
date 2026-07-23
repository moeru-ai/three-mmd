import { MMDLoader } from '@moeru/three-mmd'
import { useFrame, useLoader } from '@react-three/fiber'

const useMMD = (path: string, extendLoader?: (loader: MMDLoader) => void) => {
  const mmd = useLoader(MMDLoader, path, extendLoader)

  // `useAnimations` runs its mixer at priority 0. Restore the MMD pose before
  // that so `mmd.update()` can safely apply IK and grants after it.
  useFrame(() => mmd.beforeUpdate(), -1)

  return mmd
}

// eslint-disable-next-line @masknet/no-top-level
useMMD.preload = (path: string, extendLoader?: (loader: MMDLoader) => void) =>
  useLoader.preload(MMDLoader, path, extendLoader)

// eslint-disable-next-line @masknet/no-top-level
useMMD.clear = (path: string) =>
  useLoader.clear(MMDLoader, path)

export { useMMD }
