import { createMMDAnimationClip, MMDAnimationHelper, VMDLoader } from '@moeru/three-mmd'
import { useMMD } from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const PhysicsCorrect = () => {
  const mesh = useMMD(pmxUrl)

  const vmdLoader = useMemo(() => new VMDLoader(), [])
  const helper = useMemo(() => new MMDAnimationHelper({ afterglow: 2 }), [])

  useEffect(() => {
    vmdLoader.load(vmdUrl, (vmd) => {
      const animation = createMMDAnimationClip(vmd, mesh)

      helper.add(mesh, {
        animation,
        physics: true,
      })
    })

    return () => {
      if (!helper.meshes.includes(mesh))
        return

      helper.remove(mesh)
    }
  }, [mesh, helper, vmdLoader])

  useFrame((_, delta) => helper.update(delta))

  return (
    <primitive object={mesh} scale={0.1} />
  )
}

export default PhysicsCorrect
