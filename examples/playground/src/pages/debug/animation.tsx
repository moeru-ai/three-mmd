import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { MMDAnimationHelper, MMDLoader } from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'
import { CCDIKHelper } from 'three/examples/jsm/animation/CCDIKSolver.js'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAnimation = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const object = useLoader(MMDLoader, pmxUrl)
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    // const animation = createMMDAnimationClip(vmd, object)
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const helper = useMemo(() => new MMDAnimationHelper(), [])
  const ikHelper = useMemo(() => new CCDIKHelper(object, (object.geometry.userData.MMD as { iks: IK[] }).iks), [object])

  useEffect(() => {
    helper.add(object, {
      animation,
      physics: false,
    })

    return () => {
      helper.remove(object)
    }
  }, [object, animation, helper])

  useFrame((_, delta) => helper.update(delta))

  return (
    <>
      <primitive
        object={object}
        scale={0.1}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[object]} />}
    </>
  )
}

export default DebugAnimation
