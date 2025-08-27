import { VMDLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const useVMD = (path: string) => useLoader(VMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useVMD.preload = (path: string) =>
  useLoader.preload(VMDLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useVMD.clear = (path: string) =>
  useLoader.clear(VMDLoader, path)

export { useVMD }
