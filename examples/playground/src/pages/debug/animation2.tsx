import type { Grant } from '@moeru/three-mmd'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { GrantSolver, MMDLoader } from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useAnimations } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAnimation2 = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const object = useLoader(MMDLoader, pmxUrl)
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const ikSolver = useMemo(() => new CCDIKSolver(object, (object.geometry.userData.MMD as { iks: IK[] }).iks), [object])
  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])

  const grantSolver = useMemo(() => new GrantSolver(object, (object.geometry.userData.MMD as { grants: Grant[] }).grants), [object])

  const { actions } = useAnimations([animation], object)

  useEffect(() => {
    // console.log(object.skeleton.bones)
    actions?.dance?.play()
  })

  useFrame((_, delta) => {
    object.updateMatrixWorld(true)
    ikSolver.update(delta)
    grantSolver.update()
  })

  return (
    <>
      <primitive
        object={object}
        // ref={ref}
        scale={0.1}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[object]} />}
    </>
  )
}

export default DebugAnimation2
