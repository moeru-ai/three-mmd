import type { PmxObject } from 'babylon-mmd'
import type { LoadingManager } from 'three'

import { PmxReader } from 'babylon-mmd'
import {
  FileLoader,
  Loader,
  // LoaderUtils,
} from 'three'

/** @experimental */
export class PMXLoader extends Loader<PmxObject> {
  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (object: PmxObject) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    // let resourcePath: string
    // if (this.resourcePath !== '')
    //   resourcePath = this.resourcePath
    // else if (this.path !== '')
    //   resourcePath = LoaderUtils.resolveURL(LoaderUtils.extractUrlBase(url), this.path)
    // else
    //   resourcePath = LoaderUtils.extractUrlBase(url)

    const loader = new FileLoader(this.manager)
    loader.setResponseType('arraybuffer')
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)
    loader.load(
      url,
      buffer => void PmxReader.ParseAsync(buffer as ArrayBuffer)
        .then(onLoad)
        .catch(onError),
      onProgress,
      onError as (error: unknown) => void,
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<PmxObject> {
    return super.loadAsync(url, onProgress)
  }
}
