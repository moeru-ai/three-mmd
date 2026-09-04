import {
  useMMD,
  useMMDAnimation,
  useMMDAnimationManager,
} from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'

import vmdUrl from '../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const Index = () => {
  const mmd = useMMD(pmxUrl)
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')
  const manager = useMMDAnimationManager(undefined, (manager) => {
    manager.add(mmd, { animation })

    return () => {
      manager.remove(mmd)
    }
  })

  useFrame((_, delta) => manager.update(delta))

  return (
    <>
      <primitive object={mmd.mesh} position={[0, -1, 0]} scale={0.1} />
      <skeletonHelper args={[mmd.mesh]} />
    </>
  )
}

export default Index
