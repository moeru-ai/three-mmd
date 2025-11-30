import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useAnimations } from '@react-three/drei'
import { useEffect } from 'react'

import vmdUrl from '../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const Index = () => {
  const object = useMMD(pmxUrl)
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

export default Index
