import { MMDAnimationHelper, MMDLoader } from '@moeru/three-mmd'
import { useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useFrame, useLoader } from '@react-three/fiber'
import { useEffect } from 'react'

import pmdUrl from '../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const Index = () => {
  const object = useLoader(MMDLoader, pmdUrl)
  const animation = useMMDAnimation(vmdUrl, object, 'dance')

  const helper = new MMDAnimationHelper({ afterglow: 2 })

  useEffect(() => {
    helper.add(object, {
      animation,
      physics: true,
    })

    return () => {
      helper.remove(object)
    }
  })

  useFrame((_, delta) => helper.update(delta))

  return (
    <primitive object={object} scale={0.1} />
  )
}

export default Index
