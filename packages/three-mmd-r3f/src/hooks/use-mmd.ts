import { MMDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

/** Loads an MMD model for use with `MMDAnimationManager`. */
const useMMD = (path: string, extendLoader?: (loader: MMDLoader) => void) => {
  return useLoader(MMDLoader, path, extendLoader)
}

// eslint-disable-next-line @masknet/no-top-level
useMMD.preload = (path: string, extendLoader?: (loader: MMDLoader) => void) =>
  useLoader.preload(MMDLoader, path, extendLoader)

// eslint-disable-next-line @masknet/no-top-level
useMMD.clear = (path: string) =>
  useLoader.clear(MMDLoader, path)

export { useMMD }
