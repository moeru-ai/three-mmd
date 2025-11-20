import type { Grant } from '@moeru/three-mmd'
import type { AnimationAction, AnimationClip, SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { GrantSolver } from '@moeru/three-mmd'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AnimationMixer } from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { processBones } from '../utils/process-bones'

interface Api<T extends AnimationClip> {
  actions: { [key in T['name']]: AnimationAction | null }
  clips: AnimationClip[]
  grantSolver: GrantSolver
  ikSolver: CCDIKSolver
  mixer: AnimationMixer
  names: T['name'][]
}

export const useMMDAnimations = <T extends AnimationClip>(
  clips: T[],
  root: SkinnedMesh,
  iks?: IK[],
  grants?: Grant[],
): Api<T> => {
  const { restoreBones, saveBones } = processBones()

  const mixer = useMemo(() => new AnimationMixer(root), [root])

  const ikSolver = useMemo(() => new CCDIKSolver(root, iks ?? (root.geometry.userData.MMD as { iks: IK[] }).iks), [root, iks])
  const grantSolver = useMemo(() => new GrantSolver(root, grants ?? (root.geometry.userData.MMD as { grants: Grant[] }).grants), [root, grants])

  const lazyActions = useRef<Api<AnimationClip>['actions']>({})

  const api = useMemo<Api<T>>(() => {
    const actions = {} as { [key in T['name']]: AnimationAction | null }
    clips.forEach(clip =>
      Object.defineProperty(actions, clip.name, {
        configurable: true,
        enumerable: true,
        get: () => (
          lazyActions.current[clip.name]
          || (lazyActions.current[clip.name] = mixer.clipAction(clip, root))
        ),
      }),
    )
    return { actions, clips, grantSolver, ikSolver, mixer, names: clips.map(c => c.name) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips])

  useFrame((_, delta) => {
    restoreBones(root)

    mixer.update(delta)

    saveBones(root)

    root.updateMatrixWorld(true)
    ikSolver.update(delta)
    grantSolver.update()
  })

  useEffect(() => {
    return () => {
      // Clean up only when clips change, wipe out lazy actions and uncache clips
      lazyActions.current = {}
      mixer.stopAllAction()
      Object.values(api.actions).forEach((action) => {
        mixer.uncacheAction(action as AnimationClip, root)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips])

  return api
}
