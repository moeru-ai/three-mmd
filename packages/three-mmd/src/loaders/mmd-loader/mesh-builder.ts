import type { Pmd, Pmx } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import { Bone, Skeleton, SkinnedMesh } from 'three'

import { GeometryBuilder } from './geometry-builder'
import { MaterialBuilder } from './material-builder'

export class MeshBuilder {
  crossOrigin = 'anonymous'
  geometryBuilder: GeometryBuilder
  materialBuilder: MaterialBuilder

  constructor(manager: LoadingManager) {
    this.geometryBuilder = new GeometryBuilder()
    this.materialBuilder = new MaterialBuilder(manager)
  }

  /**
   * @param data - parsed PMD/PMX data
   */
  build(
    data: Pmd | Pmx,
    resourcePath: string,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): SkinnedMesh {
    const geometry = this.geometryBuilder.build(data)
    const material = this.materialBuilder
      .setCrossOrigin(this.crossOrigin)
      .setResourcePath(resourcePath)
      .build(data, geometry, onProgress, onError)

    const mesh = new SkinnedMesh(geometry, material)

    const skeleton = new Skeleton(this.initBones(mesh))
    mesh.bind(skeleton)

    return mesh
  }

  setCrossOrigin(crossOrigin: string): this {
    this.crossOrigin = crossOrigin
    return this
  }

  private initBones(mesh: SkinnedMesh & { geometry: { bones?: any[] } }): Bone[] {
    const geometry = mesh.geometry
    const bones: Bone[] = []

    if (geometry.bones !== undefined) {
      // first, create array of 'Bone' objects from geometry data
      for (let i = 0, il = geometry.bones.length; i < il; i++) {
        const { name, pos, rotq, scl } = geometry.bones[i] as {
          name: string
          pos: number[]
          rotq: number[]
          scl?: number[]
        }

        // create new 'Bone' object
        const bone = new Bone()

        // apply values
        bone.name = name
        bone.position.fromArray(pos)
        bone.quaternion.fromArray(rotq)
        if (scl !== undefined)
          bone.scale.fromArray(scl)

        bones.push(bone)
      }

      // second, create bone hierarchy
      for (let i = 0, il = geometry.bones.length; i < il; i++) {
        const { parent } = geometry.bones[i] as {
          parent?: number
        }

        if (parent != null && parent !== -1 && bones[parent] != null) {
          // subsequent bones in the hierarchy
          bones[parent].add(bones[i])
        }
        else {
          // topmost bone, immediate child of the skinned mesh
          mesh.add(bones[i])
        }
      }
    }

    // now the bones are part of the scene graph and children of the skinned mesh.
    // let's update the corresponding matrices
    mesh.updateMatrixWorld(true)

    return bones
  }
}
