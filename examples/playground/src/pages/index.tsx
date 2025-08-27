import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { Environment, useAnimations } from '@react-three/drei'
import { useEffect } from 'react'

import pmdUrl from '../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const Index = () => {
  const object = useMMD(pmdUrl)
  const animation = useMMDAnimation(vmdUrl, object, 'dance')
  const { actions, ref } = useAnimations([animation])

  // TODO: physics
  useEffect(() => {
    actions?.dance?.play()
  })

  return (
    <>
      <primitive object={object} ref={ref} scale={0.1} />
      <Environment background files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/belfast_sunset_puresky_2k.hdr" />
    </>
  )
}

export default Index
