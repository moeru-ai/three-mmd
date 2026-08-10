import type { Object3D } from 'three'

import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'
import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugAmmo = () => {
  const {
    gravity,
    mmdScale,
    paused,
    showIK,
    showPhysics,
    showSkeleton,
  } = useControls('Ammo', {
    gravity: {
      step: 0.1,
      value: { x: 0, y: -98, z: 0 },
    },
    mmdScale: {
      max: 1,
      min: 0.01,
      step: 0.01,
      value: 0.1,
    },
    paused: false,
    showIK: false,
    showPhysics: false,
    showSkeleton: false,
  })

  const mmd = useMMD(pmxUrl, loader => loader.register(MMDAmmoPlugin))
  const animation = useMMDAnimation(vmdUrl, mmd.mesh, 'dance')
  const animations = useMemo(() => [animation], [animation])
  const { actions } = useAnimations(animations, mmd.mesh)
  const action = actions.dance

  useFrame((_, delta) => {
    // Keep IK, grants, and the cached animation pose evaluated while the
    // animation is paused. Skipping this stage leaves the raw mixer pose on
    // the skeleton after useMMD() restores it at the start of each frame.
    mmd.update(paused ? 0 : delta)
  })

  const ikHelper = useMemo(() => mmd.ikSolver.createHelper(), [mmd.ikSolver])
  const physicsHelper = useMemo(
    () => mmd.physics?.createHelper<Object3D>(),
    [mmd.physics],
  )

  useEffect(() => {
    mmd.physics?.reset?.()
    action?.play()

    return () => {
      action?.stop()
      mmd.mesh.pose()
      if (physicsHelper && 'dispose' in physicsHelper)
        (physicsHelper as Object3D & { dispose: () => void }).dispose()
    }
  }, [action, mmd, physicsHelper])

  useEffect(() => {
    if (!action)
      return

    action.paused = paused
  }, [action, paused])

  useEffect(() => mmd.setScalar(mmdScale), [mmd, mmdScale])

  useEffect(() => {
    mmd.physics?.setGravity?.(new Vector3(gravity.x, gravity.y, gravity.z))
  }, [gravity.x, gravity.y, gravity.z, mmd.physics])

  return (
    <>
      <primitive object={mmd.mesh} position={[0, -10 * mmdScale, 0]} />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
      {showPhysics && physicsHelper && <primitive object={physicsHelper} />}
    </>
  )
}

export default DebugAmmo
