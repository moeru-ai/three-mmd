import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import {
  // createMMDAnimationClip,
  // MMDAnimationHelper,
  MMDLoader,
  // VMDLoader
} from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useAnimations } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'
import { CCDIKHelper, CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAnimation2 = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const object = useLoader(MMDLoader, pmxUrl)
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    // const animation = createMMDAnimationClip(vmd, object)
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const ikSolver = useMemo(() => new CCDIKSolver(object, (object.geometry.userData.MMD as { iks: IK[] }).iks), [object])
  const ikHelper = useMemo(() => new CCDIKHelper(object, (object.geometry.userData.MMD as { iks: IK[] }).iks), [object])

  const { actions, ref } = useAnimations([animation])

  useEffect(() => {
    // console.log(object.skeleton.bones)
    actions?.dance?.play()
  })

  useFrame((_, delta) => {
    object.updateMatrixWorld(true)
    ikSolver.update(delta)
  })

  return (
    <>
      <primitive
        object={object}
        ref={ref}
        scale={0.1}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[object]} />}
    </>
  )
}

export default DebugAnimation2
