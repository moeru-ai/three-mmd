import { buildAnimation, ExperimentalMMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'

const BAnimation = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const mmd = useLoader(ExperimentalMMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mmd.mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mmd])

  const { actions, ikSolver } = useMMDAnimations([animation], mmd.mesh, mmd.iks, mmd.grants)

  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])

  useEffect(() => {
    actions?.dance?.play()

    return () => {
      mmd.mesh.pose()
    }
  })

  return (
    <>
      <primitive object={mmd.mesh} scale={0.1} />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
    </>

  )
}

export default BAnimation
