import { MMDAmmoPhysics } from '@moeru/three-mmd-physics-ammo'
import { useMMD, useMMDAnimation, useMMDAnimations, useMMDPhysics } from '@moeru/three-mmd-r3f'
import { useControls } from 'leva'
import { useEffect, useMemo, useState } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
// import pmxUrl from '../../../../assets/安比/安比.pmx?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAmmo = () => {
  const [editingScale, setEditingScale] = useState(false)
  const {
    mmdScale,
    showIK,
    showPhysics,
    showSkeleton,
  } = useControls({
    mmdScale: {
      max: 10,
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
      // value: 0.1,
      value: 1,
    },
    showIK: false,
    showPhysics: false,
    showSkeleton: false,
  })

  const mmd = useMMD(pmxUrl)
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')

  const { actions, ikSolver } = useMMDAnimations([animation], mmd.mesh, mmd.iks, mmd.grants)

  // Helpers
  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])
  const physicsHelper = useMMDPhysics(mmd, MMDAmmoPhysics)

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

  return (
    <>
      <primitive
        object={mmd.mesh}
        // scale={mmdScale}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
      {showPhysics && (Boolean(physicsHelper)) && <primitive object={physicsHelper} />}
    </>

  )
}

export default DebugAmmo
