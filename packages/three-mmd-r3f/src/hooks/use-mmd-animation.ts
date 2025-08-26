import type { Camera } from '@react-three/fiber'
import type { AnimationClip, SkinnedMesh } from 'three'

import { createMMDAnimationClip } from '@moeru/three-mmd'

import { useVMD } from './use-vmd'

const useMMDAnimation = (vmdPath: string, object: Camera | SkinnedMesh, name?: string): AnimationClip => {
  const vmd = useVMD(vmdPath)
  const clip = createMMDAnimationClip(vmd, object)

  if (name != null)
    clip.name = name

  return clip
}

// eslint-disable-next-line @masknet/no-top-level
useMMDAnimation.preload = useVMD.preload
// eslint-disable-next-line @masknet/no-top-level
useMMDAnimation.clear = useVMD.clear

export { useMMDAnimation }
