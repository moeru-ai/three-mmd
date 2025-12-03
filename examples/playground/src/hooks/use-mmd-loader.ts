import { MMDMeshLoader as MoeruMMDLoader } from '@moeru/three-mmd'
import { useLocalStorage } from 'foxact/use-local-storage'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo } from 'react'
import { MMDLoader as StdlibMMDLoader } from 'three-stdlib'

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
      return StdlibMMDLoader
  }, [loader])
}
