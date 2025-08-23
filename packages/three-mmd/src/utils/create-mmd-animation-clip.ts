import type { Vmd } from '@noname0310/mmd-parser'
import type { Camera, SkinnedMesh } from 'three'

import { AnimationBuilder } from '../loaders/MMDLoader'

export const createMMDAnimationClip = (vmd: Vmd, object: Camera | SkinnedMesh) => {
  const builder = new AnimationBuilder()

  return ('isCamera' in object && object.isCamera)
    ? builder.buildCameraAnimation(vmd)
    : builder.build(vmd, object as SkinnedMesh)
}
