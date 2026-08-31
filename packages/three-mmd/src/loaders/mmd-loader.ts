/**
 * Experimental Three.js loader for @moeru/three-mmd-b.
 * Thin OOP shell over the functional pipeline: fetch PMD/PMX, parse via babylon-mmd,
 * then wrap the result in MMD for bone/IK/grant/spring setup.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { LoadingManager } from 'three'

import type { MMDMaterialConstructor } from '../materials/types'
import type { MMDLoaderPlugin, MMDLoaderPluginFactory } from './loader-plugin'

import { PmdReader } from 'babylon-mmd/esm/Loader/Parser/pmdReader'
import { PmxReader } from 'babylon-mmd/esm/Loader/Parser/pmxReader'
import { FileLoader, Loader, LoaderUtils, SkinnedMesh } from 'three'

import { installMMDMaterialBindings } from '../materials/core/bindings'
import { extractModelExtension } from '../utils/_extract-model-extension'
import { buildBones } from '../utils/build-bones'
import { buildGeometry } from '../utils/build-geometry'
import { buildMaterial } from '../utils/build-material'
import { MMD } from '../utils/mmd'
import { postParseProcessing } from '../utils/post-parse'

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
            onError?.(new Error(`MMDLoader: Unknown model file extension .${modelExtension}.`))
            return
          }

          const parser = {
            manager: this.manager,
            resourcePath,
          }
          const pluginsByName = new Map<string, MMDLoaderPlugin>()

          for (const callback of this.pluginCallbacks) {
            const plugin = callback(parser)

            if (!plugin.name)
              console.error('MMDLoader: Invalid plugin found: missing name')

            pluginsByName.set(plugin.name, plugin)
          }

          const plugins = [...pluginsByName.values()]
          const materialPlugins = plugins.filter(plugin => plugin.materialType !== undefined)

          if (materialPlugins.length > 1) {
            onError?.(new Error('MMDLoader: only one MMDMaterialPlugin may be registered.'))
            return
          }
          const materialType = materialPlugins[0]?.materialType

          // Parsing -> building
          void (modelExtension === 'pmd' ? PmdReader : PmxReader)
            .ParseAsync(buffer as ArrayBuffer)
            .then(async (pmx) => {
              pmx = postParseProcessing(pmx)

              for (const plugin of plugins) {
                if (!plugin.afterParse)
                  continue

                const result = await plugin.afterParse(pmx)
                if (result !== undefined)
                  pmx = result
              }

              const mmd = this.assembleMMD(pmx, resourcePath, materialType)

              for (const plugin of plugins)
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
      onError,
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

  private assembleMMD(pmx: PmxObject, resourcePath: string, materialType?: MMDMaterialConstructor): MMD {
    const geometry = buildGeometry(pmx)
    const materials = buildMaterial(pmx, geometry, resourcePath, this.manager, materialType)
    const rawMesh = new SkinnedMesh(geometry, materials)
    const skinnedMesh = buildBones(pmx, rawMesh)
    installMMDMaterialBindings(skinnedMesh)

    return new MMD(pmx, skinnedMesh)
  }
}
