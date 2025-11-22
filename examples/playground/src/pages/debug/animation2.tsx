import { MMDLoader } from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'

const DebugAnimation2 = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const object = useLoader(MMDLoader, pmxUrl)
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const { actions, ikSolver } = useMMDAnimations([animation], object)

  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])

  useEffect(() => {
    // console.log(object.skeleton.bones)
    actions?.dance?.play()

    return () => {
      object.pose()
    }
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
