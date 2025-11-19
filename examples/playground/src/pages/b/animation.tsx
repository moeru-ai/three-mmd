import { buildAnimation, MMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useAnimations } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import vmdUrl from '../../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const BAnimation = () => {
  const mesh = useLoader(MMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mesh])

  const { actions, ref } = useAnimations([animation])

  useEffect(() => {
    actions?.dance?.play()
  })

  return (
    <primitive object={mesh} ref={ref} rotation={[0, Math.PI, 0]} scale={0.1} />
  )
}

export default BAnimation
