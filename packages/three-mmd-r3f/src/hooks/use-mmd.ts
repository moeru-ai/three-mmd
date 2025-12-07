import type { MMDLoaderPlugin } from '@moeru/three-mmd'

import { MMDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const useMMD = (path: string, plugins?: MMDLoaderPlugin[]) => useLoader(
  MMDLoader,
  path,
  (loader) => {
    plugins?.forEach(
      p => loader.register(p),
    )
  },
)

// eslint-disable-next-line @masknet/no-top-level
useMMD.preload = (path: string) =>
  useLoader.preload(MMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMD.clear = (path: string) =>
  useLoader.clear(MMDLoader, path)

export { useMMD }
