import { buildAnimation, MMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useState } from 'react'

import type { SpringBoneHelpers } from '../../../../../packages/three-mmd-b/src/physics/spring-bone-physics'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'
// import pmxUrl from '../../../../assets/安比/安比.pmx?url'

const BAnimation = () => {
  const [editingScale, setEditingScale] = useState(false)
  const {
    mmdScale,
    showColliders,
    showIK,
    showJoints,
    showSkeleton,
  } = useControls({
    mmdScale: {
      max: 1,
      min: 0.01,
      onEditEnd: () => {
        // console.log('end setting scale')
        setEditingScale(false)
      },
      onEditStart: () => {
        // console.log('start setting scale')
        setEditingScale(true)
      },
      step: 0.01,
      value: 0.1,
    },
    showColliders: false,
    showIK: false,
    showJoints: false,
    showSkeleton: false,
  })

  const mmd = useLoader(MMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mmd.mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mmd])

  const { actions, ikSolver } = useMMDAnimations([animation], mmd.mesh, mmd.iks, mmd.grants)

  // Helpers
  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])
  const { colliderHelpers, jointHelpers } = useMemo(() => mmd.createPhysicsHelpers() as SpringBoneHelpers, [mmd])

  // Play the animation on mount
  useEffect(() => {
    actions.dance?.play()

    return () => {
      actions.dance?.stop()
      mmd.mesh.pose()
    }
  }, [actions, mmd])

  // Scale handling
  useEffect(() => {
    mmd.setScalar(mmdScale)
  }, [mmd, mmdScale])

  useEffect(() => {
    if (!actions?.dance)
      return

    if (editingScale) {
      actions.dance.paused = true
      actions?.dance?.stop()
      mmd.mesh.pose()
    }
    else {
      actions.dance.paused = false
      actions?.dance?.play()
    }
  }, [actions, mmd, editingScale])

  useFrame((_, delta) => {
    if (editingScale)
      return

    mmd.update(delta)
  })

  return (
    <>
      <primitive
        object={mmd.mesh}
        // scale={mmdScale}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
      {/* eslint-disable-next-line react/no-array-index-key */}
      {showColliders && colliderHelpers.map((h, i) => <primitive key={i} object={h} />)}
      {/* eslint-disable-next-line react/no-array-index-key */}
      {showJoints && jointHelpers.map((h, i) => <primitive key={i} object={h} />)}
    </>

  )
}

export default BAnimation
