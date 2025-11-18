import { createMMDAnimationClip, MMDAnimationHelper, VMDLoader } from '@moeru/three-mmd'
import { useMMD } from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const PhysicsCorrect = () => {
  const mesh = useMMD(pmdUrl)

  const vmdLoader = useMemo(() => new VMDLoader(), [])
  const helper = useMemo(() => new MMDAnimationHelper({ afterglow: 2 }), [])

  useEffect(() => {
    vmdLoader.load(vmdUrl, (vmd) => {
      const animation = createMMDAnimationClip(vmd, mesh)

      helper.add(mesh, {
        animation,
        physics: true,
      })
    })

    return () => {
      if (!helper.meshes.includes(mesh))
        return

      helper.remove(mesh)
    }
  }, [mesh, helper, vmdLoader])

  useFrame((_, delta) => helper.update(delta))

  return (
    <primitive object={mesh} scale={0.1} />
  )
}

export default PhysicsCorrect
