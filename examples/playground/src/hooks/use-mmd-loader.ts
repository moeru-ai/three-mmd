import type { MMD } from '@moeru/three-mmd-b'
import type { SkinnedMesh } from 'three'

import { MMDLoader as MoeruMMDLoader } from '@moeru/three-mmd'
import { MMDLoader as MoeruBabylonMMDLoader } from '@moeru/three-mmd-b'
import { useLocalStorage } from 'foxact/use-local-storage'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo } from 'react'
import { MMDLoader as StdlibMMDLoader } from 'three-stdlib'

// Unwrap three-mmd-b MMDLoader to make sure all return a mesh loader
const unwrapMMDResult = (value: MMD | SkinnedMesh): SkinnedMesh => {
  if (typeof value === 'object' && 'mesh' in value)
    return (value as { mesh: SkinnedMesh }).mesh
  return value
}

export const useMMDLoader = () => {
  const [mmdLoader, setMMDLoader] = useLocalStorage('moeru-mmd/playground/loader', 'moeru-mmd')

  const { loader } = useControls({
    loader: {
      options: ['moeru-mmd', 'moeru-mmd-b', 'three-stdlib'],
      value: mmdLoader,
    },
  })

  useEffect(() => {
    startTransition(() => setMMDLoader(loader))

    // const reload = setTimeout(() => window.location.reload(), 1_000)

    // return () => {
    //   clearTimeout(reload)
    // }
  }, [loader, setMMDLoader])

  return useMemo(() => {
    if (loader === 'moeru-mmd')
      return MoeruMMDLoader
    else if (loader === 'moeru-mmd-b')
      return MoeruBabylonMMDLoader
    else
      return StdlibMMDLoader
  }, [loader])
}

// Lilia: This is not a core part of the development... Let's focus on more important things :(
// Just added some comment to avoid eslint unsafe-call errors
export const useMMDMeshLoader = () => {
  const BaseLoader = useMMDLoader()
  return useMemo(() => {
    return class MMDMeshLoader extends BaseLoader {
      load(
        url: string,
        onLoad: (mesh: SkinnedMesh) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: unknown) => void,
      ) {
        // eslint-disable-next-line ts/no-unsafe-call, ts/no-unsafe-member-access
        super.load(
          url,
          (result: MMD | SkinnedMesh) => onLoad(unwrapMMDResult(result)),
          onProgress,
          onError as never,
        )
      }

      async loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<SkinnedMesh> {
        // eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call, ts/no-unsafe-member-access
        const result = await super.loadAsync(url, onProgress)
        // eslint-disable-next-line ts/no-unsafe-argument
        return unwrapMMDResult(result)
      }
    }
  }, [BaseLoader])
}
