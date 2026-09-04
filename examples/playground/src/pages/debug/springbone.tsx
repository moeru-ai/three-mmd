import type { SpringBoneHelpers } from '@moeru/three-mmd-physics-springbone'

import { MMDSpringBonePlugin } from '@moeru/three-mmd-physics-springbone'
import {
  useMMD,
  useMMDAnimation,
  useMMDAnimationManager,
} from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useState } from 'react'
import { Vector3 } from 'three'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
// import pmxUrl from '../../../../assets/安比/安比.pmx?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAmmo = () => {
  const [editingScale, setEditingScale] = useState(false)
  const {
    gravity,
    mmdScale,
    showIK,
    showPhysics,
    showSkeleton,
  } = useControls({
    gravity: {
      step: 0.1,
      value: { x: 0, y: -98, z: 0 },
    },
    mmdScale: {
      max: 1,
      min: 0.01,
      onEditEnd: () => setEditingScale(false),
      onEditStart: () => setEditingScale(true),
      step: 0.01,
      value: 0.1,
      // value: 1,
    },
    showIK: false,
    showPhysics: false,
    showSkeleton: false,
  })

  const mmd = useMMD(pmxUrl, loader => loader.register(MMDSpringBonePlugin))
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')
  const manager = useMMDAnimationManager((manager) => {
    manager.add(mmd, { animation })

    return () => manager.remove(mmd)
  })

  useFrame((_, delta) => {
    if (editingScale)
      return

    manager.update(delta)
  })

  // Helpers
  const ikHelper = useMemo(() => mmd.ikSolver.createHelper(), [mmd.ikSolver])
  const physicsHelper = useMemo(
    () => mmd.physics?.createHelper<SpringBoneHelpers>(),
    [mmd.physics],
  )

  // Play the animation on mount
  useEffect(() => mmd.setScalar(mmdScale), [mmd, mmdScale])

  useEffect(() => {
    mmd.physics?.setGravity?.(new Vector3(gravity.x, gravity.y, gravity.z))
  }, [gravity.x, gravity.y, gravity.z, mmd.physics])

  return (
    <>
      <primitive
        object={mmd.mesh}
        position={[0, -10 * mmdScale, 0]}
        scale={mmdScale}
      />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
      {showPhysics && physicsHelper?.colliderHelpers.map(helper => (
        <primitive key={helper.uuid} object={helper} />
      ))}
      {showPhysics && physicsHelper?.jointHelpers.map(helper => (
        <primitive key={helper.uuid} object={helper} />
      ))}
    </>

  )
}

export default DebugAmmo
