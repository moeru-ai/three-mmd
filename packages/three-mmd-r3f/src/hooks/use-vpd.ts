import { VPDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const useVPD = (path: string) => useLoader(VPDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useVPD.preload = (path: string) =>
  useLoader.preload(VPDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useVPD.clear = (path: string) =>
  useLoader.clear(VPDLoader, path)

export { useVPD }
