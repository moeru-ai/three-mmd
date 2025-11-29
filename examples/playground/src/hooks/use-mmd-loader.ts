import { MMDLoader as MoeruMMDLoader } from '@moeru/three-mmd'
// import { threeMMDLoader as MoeruBabylonMMDLoader } from '@moeru/three-mmd-b'
import { useLocalStorage } from 'foxact/use-local-storage'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo } from 'react'
import { MMDLoader as StdlibMMDLoader } from 'three-stdlib'

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
    //   return MoeruBabylonMMDLoader
      return MoeruMMDLoader
    else
      return StdlibMMDLoader
  }, [loader])
}
