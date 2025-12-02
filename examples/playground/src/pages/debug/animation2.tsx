import { MMDLoader, MMDPhysics } from '@moeru/three-mmd'
import { buildAnimation, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'

const DebugAnimation2 = () => {
  const { showIK, showPhysics, showSkeleton } = useControls({ showIK: false, showPhysics: false, showSkeleton: false })

  const object = useLoader(MMDLoader, pmxUrl)
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, object)
    animation.name = 'dance'
    return animation
  }, [vmd, object])

  const { actions, ikSolver } = useMMDAnimations([animation], object)

  const physics = useMemo(() => new MMDPhysics(
    object,
    // eslint-disable-next-line ts/no-unsafe-argument
    (object.geometry.userData.MMD as { rigidBodies: any[] }).rigidBodies,
    // eslint-disable-next-line ts/no-unsafe-argument
    (object.geometry.userData.MMD as { constraints: any[] }).constraints,
  ), [object])

  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])
  const physicsHelper = useMemo(() => physics.createHelper(), [physics])

  useFrame((_, delta) => physics.update(delta))

  useEffect(() => {
    actions?.dance?.play()

    return () => {
      actions?.dance?.stop()
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
      {showPhysics && <primitive object={physicsHelper} />}
      {showSkeleton && <skeletonHelper args={[object]} />}
    </>
  )
}

export default DebugAnimation2
