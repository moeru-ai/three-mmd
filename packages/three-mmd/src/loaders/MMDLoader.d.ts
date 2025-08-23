import type { Pmd, Pmx, Vmd } from '@noname0310/mmd-parser'
import type { AnimationClip, Camera, FileLoader, Loader, LoadingManager, SkinnedMesh } from 'three'

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

export class MMDLoader extends Loader<SkinnedMesh> {
  animationBuilder: object
  animationPath: string
  loader: FileLoader
  meshBuilder: MeshBuilder
  parser: null | object
  constructor(manager?: LoadingManager)

  loadAnimation(
    url: string,
    object: Camera | SkinnedMesh,
    onLoad: (object: AnimationClip | SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadPMD(
    url: string,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadPMX(
    url: string,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadVMD(
    url: string,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadVPD(
    url: string,
    isUnicode: boolean,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadWithAnimation(
    url: string,
    vmdUrl: string | string[],
    onLoad: (object: MMDLoaderAnimationObject) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  setAnimationPath(animationPath: string): this
}
