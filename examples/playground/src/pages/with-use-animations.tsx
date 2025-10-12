import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useAnimations } from '@react-three/drei'
import { useEffect } from 'react'

import pmdUrl from '../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const WithUseAnimations = () => {
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
      <skeletonHelper args={[object]} />
    </>
  )
}

export default WithUseAnimations
