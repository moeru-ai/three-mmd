import type { LoadingManager, SkinnedMesh } from 'three'

import { MMDParser } from '@noname0310/mmd-parser'
import { FileLoader, Loader } from 'three'

import { extractModelExtension } from '../utils/_extract-model-extension'
import { resolveResourcePath } from '../utils/_resolve-resource-path'
import { MeshBuilder } from './mmd-loader/mesh-builder'

/**
 * Dependencies
 *  - mmd-parser https://github.com/takahirox/mmd-parser
 *  - TGALoader
 *  - OutlineEffect
 *
 * MMDLoader creates Three.js Objects from MMD resources as
 * PMD, PMX, VMD, and VPD files.
 *
 * PMD/PMX is a model data format, VMD is a motion data format
 * VPD is a posing data format used in MMD(Miku Miku Dance).
 *
 * MMD official site
 *  - https://sites.google.com/view/evpvp/
 *
 * PMD, VMD format (in Japanese)
 *  - http://blog.goo.ne.jp/torisu_tetosuki/e/209ad341d3ece2b1b4df24abf619d6e4
 *
 * PMX format
 *  - https://gist.github.com/felixjones/f8a06bd48f9da9a4539f
 *
 * TODO
 *  - light motion in vmd support.
 *  - SDEF support.
 *  - uv/material/bone morphing support.
 *  - more precise grant skinning support.
 *  - shadow support.
 */

/** @experimental */
export class MMDLoader extends Loader<SkinnedMesh> {
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

          if (!['pmd', 'pmx'].includes(modelExtension)) {
            // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
            onError?.(new Error(`ExperimentalMMDLoader: Unknown model file extension .${modelExtension}.`) as unknown as ErrorEvent)

            return
          }

          const data = modelExtension === 'pmd'
            ? MMDParser.parsePmd(buffer as ArrayBuffer, true)
            : MMDParser.parsePmx(buffer as ArrayBuffer, true)

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
