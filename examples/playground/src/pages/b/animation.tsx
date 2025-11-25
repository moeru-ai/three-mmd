import { buildAnimation, ExperimentalMMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'
// import { VRMSpringBoneColliderShapeCapsule, VRMSpringBoneColliderShapeSphere } from '@pixiv/three-vrm'

const BAnimation = () => {
  const {
    showColliders,
    showIK,
    showJoints,
    showSkeleton,
  } = useControls({
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

  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])

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

  useEffect(() => {
    actions?.dance?.play()

    return () => {
      mmd.mesh.pose()
    }
  })

  useFrame((_, delta) => mmd.update(delta))

  const colliderHelpers = useMemo(() => mmd.createColliderHelpers(), [mmd])
  const jointHelpers = useMemo(() => mmd.createJointHelpers(), [mmd])

  return (
    <>
      <primitive
        object={mmd.mesh}
        scale={0.1}
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
