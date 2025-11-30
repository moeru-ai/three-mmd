import { createMMDAnimationClip, MMDAnimationHelper } from '@moeru/three-mmd'
import { useMMD, useVMD } from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const PhysicsIncorrect = () => {
  const mesh = useMMD(pmxUrl)
  const vmd = useVMD(vmdUrl)

  const helper = useMemo(() => new MMDAnimationHelper({ afterglow: 2 }), [])

  useEffect(() => {
    const animation = createMMDAnimationClip(vmd, mesh)

    helper.add(mesh, {
      animation,
      physics: true,
    })

    return () => {
      if (!helper.meshes.includes(mesh))
        return

      helper.remove(mesh)
    }
  }, [mesh, vmd, helper])

  useFrame((_, delta) => helper.update(delta))

  return (
    <primitive object={mesh} scale={0.1} />
  )
}

export default PhysicsIncorrect
