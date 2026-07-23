import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager, SkinnedMesh } from 'three'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils } from 'three'

import { extractModelExtension } from '../utils/_extract-model-extension'
import { buildBones } from '../utils/build-bones'
import { buildGeometry } from '../utils/build-geometry'
import { buildMaterial } from '../utils/build-material'
import { buildMesh } from '../utils/build-mesh'
import { postParseProcessing } from '../utils/post-parse'

/** @experimental */
export class MMDMeshLoader extends Loader<SkinnedMesh> {
  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (mesh: SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ): void {
    // Prepare resource path
    let resourcePath: string
    if (this.resourcePath !== '')
      resourcePath = this.resourcePath
    else if (this.path !== '')
      resourcePath = LoaderUtils.resolveURL(LoaderUtils.extractUrlBase(url), this.path)
    else
      resourcePath = LoaderUtils.extractUrlBase(url)

    // Loading
    const loader = new FileLoader(this.manager)
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
            onError?.(new Error(`MMDMeshLoader: Unknown model file extension .${modelExtension}.`) as unknown as ErrorEvent)
            return
          }
          // Parsing -> building
          void (modelExtension === 'pmd' ? PmdReader : PmxReader)
            .ParseAsync(buffer as ArrayBuffer)
            .then(pmx => onLoad(this.assembleMesh(pmx, resourcePath)))
            .catch(onError)
        }
        catch (e) {
          onError?.(e)
        }
      },
      onProgress,
      onError as (error: unknown) => void,
    )
  }

  public async loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<SkinnedMesh> {
    return super.loadAsync(url, onProgress)
  }

  private assembleMesh(pmx: PmxObject, resourcePath: string): SkinnedMesh {
    // pmx post process: Z-flip
    pmx = postParseProcessing(pmx)

    const geometry = buildGeometry(pmx)
    const materials = buildMaterial(pmx, geometry, resourcePath, this.manager)
    const rawMesh = buildMesh(geometry, materials)

    return buildBones(pmx, rawMesh)
  }
}
