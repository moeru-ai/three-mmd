import type { Pmd, Pmx, Vmd } from '@noname0310/mmd-parser'
import type { AnimationClip, LoadingManager, SkinnedMesh } from 'three'

export interface MMDLoaderAnimationObject {
  animation: AnimationClip
  mesh: SkinnedMesh
}

export class AnimationBuilder {
  build(vmd: Vmd, mesh: SkinnedMesh): AnimationClip
  buildCameraAnimation(vmd: Vmd): AnimationClip
}

export class MeshBuilder {
  crossOrigin: string
  geometryBuilder: object
  materialBuilder: object
  constructor(manager: LoadingManager)

  build(
    data: Pmd | Pmx,
    resourcePath: string,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): SkinnedMesh
  setCrossOrigin(crossOrigin: string): this
}
