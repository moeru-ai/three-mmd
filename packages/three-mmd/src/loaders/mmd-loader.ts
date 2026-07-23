/**
 * Experimental Three.js loader for @moeru/three-mmd-b.
 * Thin OOP shell over the functional pipeline: fetch PMD/PMX, parse via babylon-mmd,
 * then wrap the result in MMD for bone/IK/grant/spring setup.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager } from 'three'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils } from 'three'

import type { MMDLoaderPlugin, MMDLoaderPluginFactory } from './loader-plugin'

import { extractModelExtension } from '../utils/_extract-model-extension'
import { buildBones } from '../utils/build-bones'
import { buildGeometry } from '../utils/build-geometry'
import { buildMaterial } from '../utils/build-material'
import { buildMesh } from '../utils/build-mesh'
import { MMD } from '../utils/mmd'
import { postParseProcessing } from '../utils/post-parse'

/** @experimental */
export class MMDLoader extends Loader<MMD> {
  private pluginCallbacks: MMDLoaderPluginFactory[] = []

  constructor(manager?: LoadingManager) {
    super(manager)
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

          const parser = {
            manager: this.manager,
            resourcePath,
          }
          const plugins: Record<string, MMDLoaderPlugin> = {}

          for (const callback of this.pluginCallbacks) {
            const plugin = callback(parser)

            if (!plugin.name)
              console.error('MMDLoader: Invalid plugin found: missing name')

            plugins[plugin.name] = plugin
          }

          // Parsing -> building
          void (modelExtension === 'pmd' ? PmdReader : PmxReader)
            .ParseAsync(buffer as ArrayBuffer)
            .then(async (pmx) => {
              pmx = postParseProcessing(pmx)

              for (const plugin of Object.values(plugins)) {
                if (!plugin.afterParse)
                  continue

                const result = await plugin.afterParse(pmx)
                if (result !== undefined)
                  pmx = result
              }

              const mmd = this.assembleMMD(pmx, resourcePath)

              for (const plugin of Object.values(plugins))
                await plugin.afterBuild?.(mmd)

              onLoad(mmd)
            })
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

  public register(callback: MMDLoaderPluginFactory) {
    if (!this.pluginCallbacks.includes(callback))
      this.pluginCallbacks.push(callback)

    return this
  }

  public unregister(callback: MMDLoaderPluginFactory) {
    const index = this.pluginCallbacks.indexOf(callback)
    if (index !== -1)
      this.pluginCallbacks.splice(index, 1)

    return this
  }

  private assembleMMD(pmx: PmxObject, resourcePath: string): MMD {
    const geometry = buildGeometry(pmx)
    const materials = buildMaterial(pmx, geometry, resourcePath, this.manager)
    const rawMesh = buildMesh(geometry, materials)
    const skinnedMesh = buildBones(pmx, rawMesh)

    return new MMD(pmx, skinnedMesh)
  }
}
