import type { LoadingManager, SkinnedMesh } from 'three'

import { MMDParser } from '@noname0310/mmd-parser'
import { FileLoader, Loader } from 'three'

import { extractModelExtension } from '../utils/_extract-model-extension'
import { resolveResourcePath } from '../utils/_resolve-resource-path'
import { MeshBuilder } from './MMDLoader'

/** @experimental */
export class PMDLoader extends Loader<SkinnedMesh> {
  meshBuilder: MeshBuilder

  constructor(manager?: LoadingManager) {
    super(manager)

    this.meshBuilder = new MeshBuilder(this.manager)
  }

  public load(
    url: string,
    onLoad: (mesh: SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const loader = new FileLoader(this.manager)
    const builder = this.meshBuilder.setCrossOrigin(this.crossOrigin)
    const resourcePath = resolveResourcePath(url, this.resourcePath, this.path)

    loader.setResponseType('arraybuffer')

    loader.setPath(this.path)
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      (buffer) => {
        try {
          const modelExtension = extractModelExtension(buffer as ArrayBuffer)

          if (modelExtension !== 'pmd') {
            // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
            onError?.(new Error(`PMDLoader: Unknown model file extension .${modelExtension}.`) as unknown as ErrorEvent)

            return
          }

          const data = MMDParser.parsePmd(buffer as ArrayBuffer, true)

          const mesh = builder.build(data, resourcePath, onProgress, onError)

          onLoad(mesh)
        }
        catch (e) {
          onError?.(e as ErrorEvent)
        }
      },
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<SkinnedMesh> {
    return super.loadAsync(url, onProgress)
  }
}
