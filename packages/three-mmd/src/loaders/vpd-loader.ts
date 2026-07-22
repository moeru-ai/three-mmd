import type { VpdObject } from 'babylon-mmd/esm/Loader/Parser/vpdObject'
import type { LoadingManager } from 'three'

import { VpdReader } from 'babylon-mmd/esm/Loader/Parser/vpdReader'
import { FileLoader, Loader } from 'three'

/** @experimental */
export class VPDLoader extends Loader<VpdObject> {
  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (object: VpdObject) => void,
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
      (buffer) => {
        try {
          // VPD files are commonly Shift-JIS encoded, including Three.js's fixtures.
          const text = new TextDecoder('shift_jis').decode(buffer as ArrayBuffer)
          onLoad(VpdReader.Parse(text))
        }
        catch (error) {
          onError?.(error as ErrorEvent)
        }
      },
      onProgress,
      onError as (error: unknown) => void,
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<VpdObject> {
    return super.loadAsync(url, onProgress)
  }
}
