import type { Vpd } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import { MMDParser } from '@noname0310/mmd-parser'
import { FileLoader, Loader } from 'three'

/** @experimental */
export class VPDLoader extends Loader<Vpd> {
  animationPath?: string
  isUnicode: boolean = true

  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (vpd: Vpd) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const loader = new FileLoader(this.manager)

    if (this.animationPath != null)
      loader.setPath(this.animationPath)

    if (!this.isUnicode)
      loader.setMimeType('text/plain; charset=shift_jis')

    loader.setResponseType('text')
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      (text) => {
        try {
          onLoad(MMDParser.parseVpd(text as string, true))
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
  ): Promise<Vpd> {
    return super.loadAsync(url, onProgress)
  }

  public setAnimationPath(animationPath: string) {
    this.animationPath = animationPath
    return this
  }

  public setIsUnicode(isUnicode: boolean) {
    this.isUnicode = isUnicode
    return this
  }
}
