import type { LoadingManager } from 'three'

import { VmdObject } from 'babylon-mmd/esm/Loader/Parser/vmdObject'
import { FileLoader, Loader } from 'three'

/** @experimental */
export class VMDLoader extends Loader<VmdObject> {
  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (object: VmdObject) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const loader = new FileLoader(this.manager)
    loader.setResponseType('arraybuffer')
    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)
    loader.load(
      url,
      buffer => onLoad(VmdObject.ParseFromBuffer(buffer as ArrayBuffer)),
      onProgress,
      onError as (error: unknown) => void,
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<VmdObject> {
    return super.loadAsync(url, onProgress)
  }
}
