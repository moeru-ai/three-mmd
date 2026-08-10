import type { SkinnedMesh } from 'three'

import { MMDLoader as MoeruMMDLoader } from '@moeru/three-mmd'
import { useLocalStorage } from 'foxact/use-local-storage'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo } from 'react'
import { Mesh, MeshToonMaterial, SRGBColorSpace } from 'three'
import { MMDLoader as StdlibMMDLoader } from 'three-stdlib'

const fixStdlibMMDMaterials = (mesh: SkinnedMesh) =>
  mesh.traverse((object) => {
    if (!(object instanceof Mesh))
      return

    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!(material instanceof MeshToonMaterial))
        continue

      material.color.convertSRGBToLinear()
      material.emissive.convertSRGBToLinear()

      if (material.map !== null) {
        material.map.colorSpace = SRGBColorSpace
        material.map.needsUpdate = true
      }

      material.needsUpdate = true
    }
  })

class FixedStdlibMMDLoader extends StdlibMMDLoader {
  override load(
    url: string,
    onLoad: (mesh: SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ) {
    return super.load(
      url,
      (mesh) => {
        fixStdlibMMDMaterials(mesh)
        onLoad(mesh)
      },
      onProgress,
      onError,
    )
  }
}

export const useMMDLoader = () => {
  const [mmdLoader, setMMDLoader] = useLocalStorage('moeru-mmd/playground/loader', 'moeru-mmd')

  const { loader } = useControls({
    loader: {
      options: ['moeru-mmd', 'three-stdlib'],
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
    else
      return FixedStdlibMMDLoader
  }, [loader])
}
