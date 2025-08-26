import { MMDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const useMMD = (path: string) => useLoader(MMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMD.preload = (path: string) =>
  useLoader.preload(MMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMD.clear = (path: string) =>
  useLoader.clear(MMDLoader, path)

export { useMMD }
