import type { MMDAnimationHelperParameter } from '@moeru/three-mmd'
import type { Camera } from '@react-three/fiber'
import type { AnimationClip, SkinnedMesh } from 'three'

import { MMDAnimationHelper } from '@moeru/three-mmd'
import { useFrame } from '@react-three/fiber'

//  helper.add(mesh, {
//         animation,
//         physics: true,
//       })

//       const ikHelper = helper.objects.get(mesh)!.ikSolver.createHelper()
//       ikHelper.visible = false
//       scene.add(ikHelper)

//       const physicsHelper = helper.objects.get(mesh)!.physics!.createHelper()
//       physicsHelper.visible = false
//       scene.add(physicsHelper)

export const useMMDAnimationHelper = (animation: AnimationClip, object: Camera | SkinnedMesh, params?: MMDAnimationHelperParameter) => {
  const helper = new MMDAnimationHelper(params)

  helper.add(object, {
    animation,
    physics: true,
  })

  // afterglow: 2.0

  useFrame((_, delta) => helper.update(delta))
}
