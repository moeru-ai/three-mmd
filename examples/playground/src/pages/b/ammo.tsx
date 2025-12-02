import type { MMDPhysicsHelper } from 'three-stdlib'

import { MMDPhysics as AmmoMMDPhysics, buildAnimation, MMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useState } from 'react'

import type { BuildPhysicsOptions } from '../../../../../packages/three-mmd-b/src/utils/build-physics'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
// import pmxUrl from '../../../../assets/安比/安比.pmx?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'

const BAnimation = () => {
  const [editingScale, setEditingScale] = useState(false)
  const {
    mmdScale,
    showIK,
    showPhysicsHelper,
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
    showPhysicsHelper: false,
    showSkeleton: false,
  })

  // Inject ammo physics
  const buildAmmoPhysics = ({ mesh, pmx }: BuildPhysicsOptions) => {
    const physics = new AmmoMMDPhysics(
      mesh,
      [...pmx.rigidBodies], // 去掉 readonly
      [...pmx.joints],
    )
    physics.warmup(60)

    return {
      createPhysicsHelpers: () => physics.createHelper(),
      name: 'ammo',
      update: (delta: number) => physics.update(delta),
    }
  }

  const mmd = useLoader(MMDLoader, pmxUrl, loader => loader.register(() => ({
    buildPhysics: buildAmmoPhysics,
  })))

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mmd.mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mmd])

  const { actions, ikSolver } = useMMDAnimations([animation], mmd.mesh, mmd.iks, mmd.grants)

  // Helpers
  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])
  const physicsHelper = useMemo(() => mmd.createPhysicsHelpers(), [mmd])

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
      {showPhysicsHelper && (Boolean(physicsHelper)) && <primitive object={physicsHelper as MMDPhysicsHelper} />}
    </>

  )
}

export default BAnimation
