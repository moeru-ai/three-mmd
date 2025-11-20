import { buildAnimation, ExperimentalMMDLoader, VMDLoader } from '@moeru/three-mmd-b'
import { useAnimations } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CCDIKHelper, CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import vmdUrl from '../../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const BAnimation = () => {
  const { iks, mesh } = useLoader(ExperimentalMMDLoader, pmxUrl)

  const vmd = useLoader(VMDLoader, vmdUrl)

  const animation = useMemo(() => {
    const animation = buildAnimation(vmd, mesh)
    animation.name = 'dance'
    return animation
  }, [vmd, mesh])

  const ikSolver = useMemo(() => new CCDIKSolver(mesh, iks), [mesh, iks])
  const ikHelper = useMemo(() => new CCDIKHelper(mesh, iks), [mesh, iks])

  const { actions, ref } = useAnimations([animation])

  useEffect(() => {
    // console.log(mesh.skeleton.bones)
    actions?.dance?.play()
  })

  useFrame((_, delta) => {
    mesh.updateMatrixWorld(true)
    ikSolver.update(delta)
  })

  return (
    <>
      <primitive object={mesh} ref={ref} rotation={[0, Math.PI, 0]} scale={0.1} />
      <primitive object={ikHelper} />
    </>

  )
}

export default BAnimation
