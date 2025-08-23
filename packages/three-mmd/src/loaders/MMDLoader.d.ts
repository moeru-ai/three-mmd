import type { AnimationClip, Camera, FileLoader, Loader, LoadingManager, SkinnedMesh } from 'three'

export interface MMDLoaderAnimationObject {
  animation: AnimationClip
  mesh: SkinnedMesh
}

export class MMDLoader extends Loader<SkinnedMesh> {
  animationBuilder: object
  animationPath: string
  loader: FileLoader
  meshBuilder: object
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
