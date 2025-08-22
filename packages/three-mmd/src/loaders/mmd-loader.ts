import type { Vmd } from '@noname0310/mmd-parser'
import type {
  AnimationClip,
  Camera,
  LoadingManager,
  SkinnedMesh,
} from 'three'

import { MMDParser } from '@noname0310/mmd-parser'
import {
  FileLoader,
  Loader,
  LoaderUtils,
} from 'three'

import { AnimationBuilder } from './mmd-loader/animation-builder'
import { MeshBuilder } from './mmd-loader/mesh-builder'

export interface MMDLoaderAnimationObject {
  animation: AnimationClip
  mesh: SkinnedMesh
}

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

export class MMDLoader extends Loader {
  animationBuilder: AnimationBuilder
  animationPath: string
  loader: FileLoader
  meshBuilder: MeshBuilder

  constructor(manager: LoadingManager) {
    super(manager)

    this.loader = new FileLoader(this.manager)

    // this.parser = null // lazy generation
    this.meshBuilder = new MeshBuilder(this.manager)
    this.animationBuilder = new AnimationBuilder()

    // TODO: remove this
    this.animationPath = ''

    console.warn('THREE.MMDLoader: The module has been deprecated and will be removed with r172. Please migrate to https://github.com/takahirox/three-mmd-loader instead.')
  }

  _extractModelExtension(buffer: ArrayBuffer) {
    const decoder = new TextDecoder('utf-8')
    const bytes = new Uint8Array(buffer, 0, 3)
    return decoder.decode(bytes).toLowerCase()
  }

  /**
   * Loads Model file (.pmd or .pmx) as a SkinnedMesh.
   *
   * @param {string} url - url to Model(.pmd or .pmx) file
   * @param {Function} onLoad
   * @param {Function} onProgress
   * @param {Function} onError
   */
  load(
    url: string,
    onLoad: (object: AnimationClip | SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    const builder = this.meshBuilder.setCrossOrigin(this.crossOrigin)

    // resource path

    let resourcePath

    if (this.resourcePath !== '') {
      resourcePath = this.resourcePath
    }
    else if (this.path !== '') {
      resourcePath = this.path
    }
    else {
      resourcePath = LoaderUtils.extractUrlBase(url)
    }

    this.loader
      // .setMimeType(undefined)
      .setPath(this.path)
      .setResponseType('arraybuffer')
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .load(url, (buffer) => {
        try {
          // TODO: check string
          const modelExtension = this._extractModelExtension(buffer as ArrayBuffer)

          if (modelExtension !== 'pmd' && modelExtension !== 'pmx') {
            if (onError)
              onError(new Error(`THREE.MMDLoader: Unknown model file extension .${modelExtension}.`))

            return
          }

          const data = modelExtension === 'pmd'
            ? MMDParser.parsePmd(buffer as ArrayBuffer, true)
            : MMDParser.parsePmx(buffer as ArrayBuffer, true)

          onLoad(builder.build(data, resourcePath, onProgress, onError))
        }
        catch (e) {
          if (onError)
            onError(e)
        }
      }, onProgress, onError)
  }

  /**
   * Loads Motion file(s) (.vmd) as a AnimationClip.
   * If two or more files are specified, they'll be merged.
   */
  loadAnimation(
    url: string | string[],
    object: Camera | SkinnedMesh,
    onLoad: (object: AnimationClip | SkinnedMesh) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    this.loadVMD(url, (vmd) => {
      onLoad(('isCamera' in object && object.isCamera)
        ? this.animationBuilder.buildCameraAnimation(vmd as Vmd)
        : this.animationBuilder.build(vmd as Vmd, object as SkinnedMesh))
    }, onProgress, onError)
  }

  /**
   * Loads .pmd file as an Object.
   */
  loadPMD(
    url: string,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    this.loader
      // .setMimeType(undefined)
      .setPath(this.path)
      .setResponseType('arraybuffer')
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .load(url, (buffer) => {
        try {
          // TODO: check string
          onLoad(MMDParser.parsePmd(buffer as ArrayBuffer, true))
        }
        catch (e) {
          if (onError)
            onError(e)
        }
      }, onProgress, onError)
  }

  /**
   * Loads .pmx file as an Object.
   *
   * @param {string} url - url to .pmx file
   * @param {Function} onLoad
   * @param {Function} onProgress
   * @param {Function} onError
   */
  loadPMX(
    url: string,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    this.loader
      // .setMimeType(undefined)
      .setPath(this.path)
      .setResponseType('arraybuffer')
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .load(url, (buffer) => {
        try {
          // TODO: check string
          onLoad(MMDParser.parsePmx(buffer as ArrayBuffer, true))
        }
        catch (e) {
          if (onError)
            onError(e)
        }
      }, onProgress, onError)
  }

  /**
   * Loads .vmd file as an Object. If two or more files are specified
   * they'll be merged.
   */
  loadVMD(
    url: string | string[],
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    const urls = Array.isArray(url) ? url : [url]

    const vmds: Vmd[] = []
    const vmdNum = urls.length

    this.loader
      // .setMimeType(undefined)
      .setPath(this.animationPath)
      .setResponseType('arraybuffer')
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)

    for (let i = 0, il = urls.length; i < il; i++) {
      this.loader.load(urls[i], (buffer) => {
        try {
          // TODO: check string
          vmds.push(MMDParser.parseVmd(buffer as ArrayBuffer, true))

          if (vmds.length === vmdNum)
            onLoad(MMDParser.mergeVmds(vmds))
        }
        catch (e) {
          if (onError)
            onError(e)
        }
      }, onProgress, onError)
    }
  }

  /**
   * Loads .vpd file as an Object.
   */
  loadVPD(
    url: string,
    isUnicode: boolean,
    onLoad: (object: object) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    if (isUnicode) {
      this.loader
        .setMimeType('text/plain; charset=shift_jis')
    }

    this.loader
      // .setMimeType(isUnicode ? undefined : 'text/plain; charset=shift_jis')
      .setPath(this.animationPath)
      .setResponseType('text')
      .setRequestHeader(this.requestHeader)
      .setWithCredentials(this.withCredentials)
      .load(url, (text) => {
        try {
          // TODO: check array buffer
          onLoad(MMDParser.parseVpd(text as string, true))
        }
        catch (e) {
          if (onError)
            onError(e)
        }
      }, onProgress, onError)
  }

  // private methods

  /**
   * Loads mode file and motion file(s) as an object containing
   * a SkinnedMesh and a AnimationClip.
   * Tracks of AnimationClip are fitting to the model.
   */
  loadWithAnimation(
    modelUrl: string,
    vmdUrl: string | string[],
    onLoad: (object: MMDLoaderAnimationObject) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    this.load(modelUrl, (mesh) => {
      this.loadAnimation(vmdUrl, mesh as SkinnedMesh, (animation) => {
        onLoad({
          animation: animation as AnimationClip,
          mesh: mesh as SkinnedMesh,
        })
      }, onProgress, onError)
    }, onProgress, onError)
  }

  setAnimationPath(animationPath: string) {
    this.animationPath = animationPath
    return this
  }
}
