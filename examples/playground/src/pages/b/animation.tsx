import { buildAnimation, ExperimentalMMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

import vmdUrl from '../../../../assets/Telephone/モーションデータ(forMMD)/telephone_motion.vmd?url'
import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDAnimations } from '../../hooks/use-mmd-animations'

const BAnimation = () => {
  const { showIK, showSkeleton } = useControls({ showIK: false, showSkeleton: false })

  const { iks, mesh, grants } = useLoader(ExperimentalMMDLoader, pmxUrl)
  // check iks
  // const { bones } = mesh.skeleton
  // iks.forEach((ik) => {
  //   console.log(
  //     'target', ik.target, bones[ik.target].name,
  //     'effector', ik.effector, bones[ik.effector].name,
  //     'links', ik.links.map(l => `${l.index}:${bones[l.index].name}`)
  //   )
  // })
  
  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mesh])

  const { actions, ikSolver } = useMMDAnimations([animation], mesh, iks, grants)

  // console.log(
  //   animation.tracks
  //     .map(t => t.name)
  //     .filter(n => n.includes('ＩＫ') || n.toLowerCase().includes('ik'))
  // )

  const ikHelper = useMemo(() => ikSolver.createHelper(), [ikSolver])

  useEffect(() => {
    // console.log(mesh.skeleton.bones)
    actions?.dance?.play()
  })

  return (
    <>
      <primitive object={mesh} rotation={[0, Math.PI, 0]} scale={0.1} />
      {showIK && <primitive object={ikHelper} />}
      {showSkeleton && <skeletonHelper args={[mesh]} />}
    </>

  )
}

export default BAnimation
