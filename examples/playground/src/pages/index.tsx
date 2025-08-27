import { MMDAnimationHelper } from '@moeru/three-mmd'
import { useMMD, useMMDAnimation } from '@moeru/three-mmd-r3f'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import pmdUrl from '../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const Index = () => {
  const object = useMMD(pmdUrl)
  const animation = useMMDAnimation(vmdUrl, object, 'dance')

  const helper = new MMDAnimationHelper({ afterglow: 2 })
  const scene = useThree(({ scene }) => scene)

  useEffect(() => {
    helper.add(object, {
      animation,
      physics: true,
    })

    const ikHelper = helper.objects.get(object)!.ikSolver.createHelper()
    ikHelper.visible = false
    scene.add(ikHelper)

    const physicsHelper = helper.objects.get(object)!.physics!.createHelper()
    physicsHelper.visible = false
    scene.add(physicsHelper)

    return () => {
      helper.remove(object)
      scene.remove(ikHelper)
      scene.remove(physicsHelper)
    }
  })

  useFrame((_, delta) => helper.update(delta))

  return (
    <primitive object={object} scale={0.1} />
  )
}

export default Index
