import { buildAnimation, ExperimentalMMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useState } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
// import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import pmxUrl from '../../../../assets/安比/安比.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'
// import { VRMSpringBoneColliderShapeCapsule, VRMSpringBoneColliderShapeSphere } from '@pixiv/three-vrm'

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

  const mmd = useLoader(ExperimentalMMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mmd.mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mmd])

  const { actions, ikSolver } = useMMDAnimations([animation], mmd.mesh, mmd.iks, mmd.grants)

  // https://github.com/pixiv/three-vrm/blob/dev/guides/spring-bones-on-scaled-models.md
  // useEffect(() => {
  //   const scale = 0.1

  //   mmd.mesh.scale.setScalar(scale)
  //   for (const joint of mmd.springBoneManager.joints) {
  //     joint.settings.stiffness *= scale;
  //     joint.settings.hitRadius *= scale;
  //   }
  //   for (const collider of mmd.springBoneManager.colliders) {
  //     const shape = collider.shape;
  //     if (shape instanceof VRMSpringBoneColliderShapeCapsule) {
  //       shape.radius *= scale;
  //       shape.tail.multiplyScalar(scale);
  //     } else if (shape instanceof VRMSpringBoneColliderShapeSphere) {
  //       shape.radius *= scale;
  //     }
  //   }
  // }, [mmd])

  // Helpers
  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver, mmd])
  const colliderHelpers = useMemo(() => mmd.createColliderHelpers(), [mmd])
  const jointHelpers = useMemo(() => mmd.createJointHelpers(), [mmd])

  // Play the animation on mount
  useEffect(() => {
    if (!actions?.dance)
      return
    actions?.dance?.play()

    return () => {
      actions?.dance?.stop()
      mmd.mesh.pose()
    }
  }, [actions])

  // Scale handling
  useEffect(() => {
    mmd.setScale(mmdScale)
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
  }, [actions, editingScale])

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
