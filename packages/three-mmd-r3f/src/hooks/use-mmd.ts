import type { MMDLoaderPlugin } from '@moeru/three-mmd'

import { MMDLoader } from '@moeru/three-mmd'
import { useFrame, useLoader } from '@react-three/fiber'

const useMMD = (path: string, plugins?: MMDLoaderPlugin[]) => {
  const mmd = useLoader(
    MMDLoader,
    path,
    (loader) => {
      plugins?.forEach(
        p => loader.register(p),
      )
    },
  )

  // `useAnimations` runs its mixer at priority 0. Restore the MMD pose before
  // that so `mmd.update()` can safely apply IK and grants after it.
  useFrame(() => {
    mmd.beforeAnimation()
  }, -1)

  return mmd
}

// eslint-disable-next-line @masknet/no-top-level
useMMD.preload = (path: string) =>
  useLoader.preload(MMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMD.clear = (path: string) =>
  useLoader.clear(MMDLoader, path)

export { useMMD }
