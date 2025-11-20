import {
  // createMMDAnimationClip,
  MMDAnimationHelper,
  MMDLoader,
  // VMDLoader
} from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
// import { useAnimations } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAnimation = () => {
  const object = useLoader(MMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    // const animation = createMMDAnimationClip(vmd, object)
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const helper = new MMDAnimationHelper({ afterglow: 2 })

  useEffect(() => {
    helper.add(object, {
      animation,
      physics: false,
    })

    return () => {
      helper.remove(object)
    }
  })

  useFrame((_, delta) => helper.update(delta))

  // const { actions, ref } = useAnimations([animation])

  // useEffect(() => {
  //   actions?.dance?.play()
  // })

  return (
    <primitive
      object={object}
      // ref={ref}
      scale={0.1}
    />
  )
}

export default DebugAnimation
