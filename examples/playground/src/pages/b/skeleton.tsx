import type { SkinnedMesh } from 'three'

import { MMDLoader } from '@moeru/three-mmd'
import { MMDLoader as BabylonMMDLoader } from '@moeru/three-mmd-b'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo, useState } from 'react'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'

const BSkeleton = () => {
  const { babylonMMD } = useControls({ babylonMMD: true })

  const mmdLoader = useMemo(() => new MMDLoader(), [])
  const babylonMmdLoader = useMemo(() => new BabylonMMDLoader(), [])

  const [object, setObject] = useState<SkinnedMesh>()
  useEffect(() => {
    startTransition(async () => {
      let mesh: SkinnedMesh
      if (babylonMMD)
        mesh = await babylonMmdLoader.loadAsync(pmdUrl)
      else
        mesh = await mmdLoader.loadAsync(pmdUrl)

      setObject(mesh)

      console.warn(mesh.skeleton.bones[0])
    })
  }, [babylonMMD, babylonMmdLoader, mmdLoader])

  if (!object)
    return

  return (
    <>
      <primitive object={object} scale={0.1} />
      <skeletonHelper args={[object]} />
    </>
  )
}

export default BSkeleton
