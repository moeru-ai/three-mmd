import type { MMDPhysicsHelper } from '@moeru/three-mmd-physics-ammo'

import { applyVPD } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'
import { useMMD, useVPD } from '@moeru/three-mmd-r3f'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import modelUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const threeMmdBaseUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/mmd'

const poses = Object.fromEntries(
  ['01', '02', '03', '04', '05', '06', '07', '08', '11'].map(number => [
    `${number}.vpd`,
    `${threeMmdBaseUrl}/vpds/${number}.vpd`,
  ]),
)

const DebugVPD = () => {
  const { pose, scale, showIK, showPhysics, showSkeleton } = useControls('VPD', {
    pose: {
      options: poses,
      value: poses['01.vpd'],
    },
    scale: {
      max: 10,
      min: 0.01,
      step: 0.01,
      value: 0.1,
    },
    showIK: false,
    showPhysics: false,
    showSkeleton: false,
  })

  const mmd = useMMD(modelUrl, loader => loader.register(MMDAmmoPlugin))
  const vpd = useVPD(pose)
  useFrame((_, delta) => mmd.update(delta))
  const ikHelper = useMemo(() => mmd.ikSolver.createHelper(), [mmd.ikSolver])
  const physicsHelper = useMemo(
    () => mmd.physics?.createHelper<MMDPhysicsHelper>(),
    [mmd.physics],
  )

  useEffect(() => {
    applyVPD(mmd, vpd)

    return () => {
      mmd.mesh.pose()
    }
  }, [mmd, vpd])

  useEffect(() => {
    mmd.setScalar(scale)
  }, [mmd, scale])

  return (
    <>
      <primitive object={mmd.mesh} />
      {showIK && <primitive object={ikHelper} />}
      {showPhysics && physicsHelper && <primitive object={physicsHelper} />}
      {showSkeleton && <skeletonHelper args={[mmd.mesh]} />}
    </>
  )
}

export default DebugVPD
