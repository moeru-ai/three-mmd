import type { SkinnedMesh } from 'three'

import { MMDLoader } from '@moeru/three-mmd'
import { MMDLoader as BabylonMMDLoader, buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useAnimations } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo, useState } from 'react'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const BSkeleton = () => {
  const {
    babylonMMD,
    showSkeleton,
    withAnimation,
  } = useControls({
    babylonMMD: true,
    showSkeleton: false,
    withAnimation: false,
  })

  const mmdLoader = useMemo(() => new MMDLoader(), [])
  const babylonMmdLoader = useMemo(() => new BabylonMMDLoader(), [])

  const [object, setObject] = useState<SkinnedMesh>(useLoader(BabylonMMDLoader, pmdUrl))
  useEffect(() => {
    startTransition(async () => {
      let mesh: SkinnedMesh
      if (babylonMMD)
        mesh = await babylonMmdLoader.loadAsync(pmdUrl)
      else
        mesh = await mmdLoader.loadAsync(pmdUrl)

      setObject(mesh)
    })
  }, [babylonMMD, babylonMmdLoader, mmdLoader])

  const vmd = useLoader(VMDLoader, vmdUrl)
  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, object)
    animation.name = 'wavefile'
    return animation
  }, [vmd, object])
  const { actions, ref } = useAnimations([animation])

  useEffect(() => {
    if (withAnimation)
      actions.wavefile?.play()

    return () => {
      actions.wavefile?.stop()
    }
  }, [actions, withAnimation])

  return (
    <>
      <primitive object={object} ref={ref} rotation={[0, Math.PI, 0]} scale={0.1} />
      {showSkeleton && <skeletonHelper args={[object]} />}
    </>
  )
}

export default BSkeleton
