import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'

import vmdUrl from '../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const Index = () => {
  const mmd = useMMD(pmxUrl)
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')
  const { actions } = useAnimations([animation], mmd.mesh)

  // Keep this after `useAnimations`: both use priority 0, so the generic mixer
  // samples the VMD first and MMD then applies its IK and grants.
  useFrame((_, delta) => mmd.update(delta))

  useEffect(() => {
    const action = actions?.dance
    action?.play()

    return () => {
      action?.stop()
      mmd.mesh.pose()
    }
  }, [actions, mmd])

  return (
    <>
      <primitive object={mmd.mesh} scale={0.1} />
      <skeletonHelper args={[mmd.mesh]} />
    </>
  )
}

export default Index
