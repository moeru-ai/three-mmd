import {
  useMMDAnimation,
  useMMDAnimationManager,
} from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'

import vmdUrl from '../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

import { useMMDWithDebug } from '../hooks/use-mmd-with-debug'

const Index = () => {
  const mmd = useMMDWithDebug(pmxUrl)
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')
  const manager = useMMDAnimationManager()
  // TODO: handle dynamic mmd
  // const manager = useMMDAnimationManager(undefined, (manager) => {
  //   manager.add(mmd, { animation })

  //   return () => {
  //     manager.remove(mmd)
  //   }
  // })

  useEffect(() => {
    manager.add(mmd, { animation })

    return () => {
      manager.remove(mmd)
    }
  }, [manager, mmd, animation])

  useFrame((_, delta) => manager.update(delta))

  return (
    <primitive object={mmd.mesh} position={[0, -1, 0]} scale={0.1} />
  )
}

export default Index
