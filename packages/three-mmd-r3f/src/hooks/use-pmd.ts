import { PMDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const usePMD = (path: string) => useLoader(PMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
usePMD.preload = (path: string) =>
  useLoader.preload(PMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
usePMD.clear = (path: string) =>
  useLoader.clear(PMDLoader, path)

export { usePMD }
