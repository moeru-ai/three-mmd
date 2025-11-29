/**
 * Experimental Three.js loader for @moeru/three-mmd-b.
 * Thin OOP shell over the functional pipeline: fetch PMD/PMX, parse via babylon-mmd,
 * then wrap the result in MMD for bone/IK/grant/spring setup.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager } from 'three'
import type { ThreeMMDLoaderDeps, ThreeMMDPlugin } from './loader-deps'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils } from 'three'

import { extractModelExtension } from '../../../three-mmd/src/utils/_extract-model-extension'
import { MMD } from '../utils/mmd'
import { defaultDeps, resolveDeps } from './loader-deps'

/** @experimental */
export class ThreeMMDLoader extends Loader<MMD> {
  private plugins: ThreeMMDPlugin[] = []

  constructor(plugins: ThreeMMDPlugin[] = [], manager?: LoadingManager) {
    super(manager)
    this.plugins.push(...plugins)
  }

  public load(
    url: string,
    onLoad: (mesh: MMD) => void,
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
            onError?.(new Error(`MMDLoader: Unknown model file extension .${modelExtension}.`) as unknown as ErrorEvent)
            return
          }
          // Parsing -> building
          void (modelExtension === 'pmd' ? PmdReader : PmxReader)
            .ParseAsync(buffer as ArrayBuffer)
            .then(pmx => onLoad(this.assembleMMD(pmx, resourcePath, buildDeps)))
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
  ): Promise<MMD> {
    return super.loadAsync(url, onProgress)
  }

  // If loaded then register new plugins, it will only be effective at the next load
  public register(plugin: ThreeMMDPlugin) {
    this.plugins.push(plugin)
    return this
  }

  // MMD model assembly pipeline
  private assembleMMD(
    pmx: PmxObject,
    resourcePath: string,
    deps: ThreeMMDLoaderDeps = defaultDeps,
  ): MMD {
    const {
      buildBones,
      buildGeometry,
      buildGrants,
      buildIK,
      buildMaterials,
      buildMesh,
      buildPhysics,
      postParseProcessing,
    } = deps

    // pmx post process: Z-flip
    pmx = postParseProcessing(pmx)

    const geometry = buildGeometry(pmx)
    const materials = buildMaterials(pmx, geometry, resourcePath)
    const rawMesh = buildMesh(geometry, materials)
    const skinnedMesh = buildBones(pmx, rawMesh)
    const grants = buildGrants(pmx)
    const iks = buildIK(pmx)
    const physics = buildPhysics({ grants, iks, mesh: skinnedMesh, pmx })

    const mmd = new MMD(skinnedMesh, grants, iks, physics)
    return mmd
  }

  private getResolvedDeps() {
    return resolveDeps(this.plugins, defaultDeps)
  }
}
