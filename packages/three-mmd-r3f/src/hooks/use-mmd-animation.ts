import type { Camera } from '@react-three/fiber'
import type { AnimationClip, SkinnedMesh } from 'three'

import { buildAnimation, buildCameraAnimation } from '@moeru/three-mmd'
import { useMemo } from 'react'

import { useVMD } from './use-vmd'

const useMMDAnimation = (vmdPath: string, object: Camera | SkinnedMesh, name?: string): AnimationClip => {
  const vmd = useVMD(vmdPath)

  return useMemo(() => {
    const c = ('isCamera' in object && object.isCamera)
      ? buildCameraAnimation(vmd)
      : buildAnimation(vmd, object as SkinnedMesh)

    if (name != null)
      c.name = name

    return c
  }, [vmd, object, name])
}

// eslint-disable-next-line @masknet/no-top-level
useMMDAnimation.preload = useVMD.preload
// eslint-disable-next-line @masknet/no-top-level
useMMDAnimation.clear = useVMD.clear

export { useMMDAnimation }
