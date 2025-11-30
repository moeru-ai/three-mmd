import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager, SkinnedMesh } from 'three'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils } from 'three'

import type { MMDLoaderDeps, MMDLoaderPlugin } from './loader-deps'

import { extractModelExtension } from '../../../three-mmd/src/utils/_extract-model-extension'
import { defaultDeps, resolveDeps } from './loader-deps'

/** @experimental */
export class MMDMeshLoader extends Loader<SkinnedMesh> {
  private plugins: MMDLoaderPlugin[] = []

  constructor(plugins: MMDLoaderPlugin[] = [], manager?: LoadingManager) {
    super(manager)
    this.plugins.push(...plugins)
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

    // Load dependent builders
    const buildDeps = this.getResolvedDeps()

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
            .then(pmx => onLoad(this.assembleMesh(pmx, resourcePath, buildDeps)))
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

  // If loaded then register new plugins, it will only be effective at the next load
  public register(plugin: MMDLoaderPlugin) {
    this.plugins.push(plugin)
    return this
  }

  // MMD model assembly pipeline
  private assembleMesh(
    pmx: PmxObject,
    resourcePath: string,
    deps: MMDLoaderDeps = defaultDeps,
  ): SkinnedMesh {
    const {
      buildBones,
      buildGeometry,
      buildMaterials,
      buildMesh,
      postParseProcessing,
    } = deps

    // pmx post process: Z-flip
    pmx = postParseProcessing(pmx)

    const geometry = buildGeometry(pmx)
    const materials = buildMaterials(pmx, geometry, resourcePath)
    const rawMesh = buildMesh(geometry, materials)

    return buildBones(pmx, rawMesh)
  }

  private getResolvedDeps() {
    return resolveDeps(this.plugins, defaultDeps)
  }
}
