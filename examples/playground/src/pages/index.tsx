import { useMMDAnimation, useMMDMesh } from '@moeru/three-mmd-r3f'
import { useAnimations } from '@react-three/drei'
import { useEffect } from 'react'

import vmdUrl from '../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const Index = () => {
  const object = useMMDMesh(pmxUrl)
  const animation = useMMDAnimation(vmdUrl, object, 'dance')
  const { actions, ref } = useAnimations([animation])

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
