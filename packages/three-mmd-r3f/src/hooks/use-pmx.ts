import { PMXLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const usePMX = (path: string) => useLoader(PMXLoader, path)

// eslint-disable-next-line @masknet/no-top-level
usePMX.preload = (path: string) =>
  useLoader.preload(PMXLoader, path)

// eslint-disable-next-line @masknet/no-top-level
usePMX.clear = (path: string) =>
  useLoader.clear(PMXLoader, path)

export { usePMX }
