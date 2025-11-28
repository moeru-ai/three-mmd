import type { LoadingManager } from 'three'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils } from 'three'

import { extractModelExtension } from '../../../three-mmd/src/utils/_extract-model-extension'
import { SpringBoneMMD } from '../utils/spring-bone-mmd'

/** @experimental */
export class SpringBoneMMDLoader extends Loader<SpringBoneMMD> {
  constructor(manager?: LoadingManager) {
    super(manager)
  }

  public load(
    url: string,
    onLoad: (mesh: SpringBoneMMD) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ): void {
    let resourcePath: string
    if (this.resourcePath !== '')
      resourcePath = this.resourcePath
    else if (this.path !== '')
      resourcePath = LoaderUtils.resolveURL(LoaderUtils.extractUrlBase(url), this.path)
    else
      resourcePath = LoaderUtils.extractUrlBase(url)

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
            onError?.(new Error(`MMDLoader: Unknown model file extension .${modelExtension}.`) as unknown as ErrorEvent)

            return
          }

          void (modelExtension === 'pmd' ? PmdReader : PmxReader)
            .ParseAsync(buffer as ArrayBuffer)
            .then(pmx => onLoad(new SpringBoneMMD(pmx, resourcePath)))
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
  ): Promise<SpringBoneMMD> {
    return super.loadAsync(url, onProgress)
  }
}
