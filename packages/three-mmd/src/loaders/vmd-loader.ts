import type { Vmd } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import { MMDParser } from '@noname0310/mmd-parser'
import { FileLoader, Loader } from 'three'

/** @experimental */
export class VMDLoader extends Loader<Vmd> {
  animationPath?: string

  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (vmd: Vmd) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const loader = new FileLoader(this.manager)

    if (this.animationPath != null)
      loader.setPath(this.animationPath)

    loader.setResponseType('arraybuffer')
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      (buffer) => {
        try {
          onLoad(MMDParser.parseVmd(buffer as ArrayBuffer, true))
        }
        catch (e) {
          onError?.(e as ErrorEvent)
        }
      },
      onProgress,
      onError as (error: unknown) => void,
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<Vmd> {
    return super.loadAsync(url, onProgress)
  }

  public setAnimationPath(animationPath: string) {
    this.animationPath = animationPath
    return this
  }
}
