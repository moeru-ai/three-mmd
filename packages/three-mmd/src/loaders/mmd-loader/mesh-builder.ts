import type { Pmd, Pmx } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import { Skeleton, SkinnedMesh } from 'three'

import { GeometryBuilder } from './geometry-builder'
import { initBones } from './init-bones'
import { MaterialBuilder } from './material-builder'

export class MeshBuilder {
  crossOrigin: string
  geometryBuilder: GeometryBuilder
  materialBuilder: MaterialBuilder

  constructor(manager: LoadingManager) {
    this.crossOrigin = 'anonymous'
    this.geometryBuilder = new GeometryBuilder()
    this.materialBuilder = new MaterialBuilder(manager)
  }

  build(
    data: Pmd | Pmx,
    resourcePath: string,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ) {
    const geometry = this.geometryBuilder.build(data)
    const material = this.materialBuilder
      .setCrossOrigin(this.crossOrigin)
      .setResourcePath(resourcePath)
      .build(data, geometry, onProgress, onError)

    const mesh = new SkinnedMesh(geometry, material)

    const skeleton = new Skeleton(initBones(mesh))
    mesh.bind(skeleton)
    return mesh
  }

  setCrossOrigin(crossOrigin: string) {
    this.crossOrigin = crossOrigin
    return this
  }
}
