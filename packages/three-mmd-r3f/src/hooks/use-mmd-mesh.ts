import { MMDMeshLoader } from '@moeru/three-mmd'
import { useLoader } from '@react-three/fiber'

const useMMDMesh = (path: string) => useLoader(MMDMeshLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMDMesh.preload = (path: string) =>
  useLoader.preload(MMDMeshLoader, path)

// eslint-disable-next-line @masknet/no-top-level
useMMDMesh.clear = (path: string) =>
  useLoader.clear(MMDMeshLoader, path)

export { useMMDMesh }
