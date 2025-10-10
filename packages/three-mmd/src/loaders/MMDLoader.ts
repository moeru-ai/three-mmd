/* eslint-disable ts/strict-boolean-expressions */
/* eslint-disable sonarjs/different-types-comparison */
/* eslint-disable ts/no-unsafe-assignment */
/* eslint-disable ts/no-unsafe-member-access */
/* eslint-disable ts/no-unsafe-argument */

import type { Pmd, Pmx } from '@noname0310/mmd-parser'
import type { LoadingManager } from 'three'

import {
  Bone,
  Skeleton,
  SkinnedMesh,
} from 'three'

import { GeometryBuilder } from './mmd-loader/geometry-builder'
import { MaterialBuilder } from './mmd-loader/material-builder'

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
const initBones = (mesh: SkinnedMesh & { geometry: { bones?: any[] } }) => {
  const geometry = mesh.geometry

  const bones = []

  if (geometry && geometry.bones !== undefined) {
    // first, create array of 'Bone' objects from geometry data

    for (let i = 0, il = geometry.bones.length; i < il; i++) {
      const gbone = geometry.bones[i]

      // create new 'Bone' object

      const bone = new Bone()
      bones.push(bone)

      // apply values

      bone.name = gbone.name
      bone.position.fromArray(gbone.pos)
      bone.quaternion.fromArray(gbone.rotq)
      if (gbone.scl !== undefined)
        bone.scale.fromArray(gbone.scl)
    }

    // second, create bone hierarchy

    for (let i = 0, il = geometry.bones.length; i < il; i++) {
      const gbone = geometry.bones[i]

      if ((gbone.parent !== -1) && (gbone.parent !== null) && (bones[gbone.parent] !== undefined)) {
        // subsequent bones in the hierarchy

        bones[gbone.parent].add(bones[i])
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

/**
 * @param {import('three').LoadingManager} manager
 */
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
   * @param onProgress
   * @param onError
   * @return {SkinnedMesh}
   */
  build(data: Pmd | Pmx, resourcePath: string, onProgress: () => void, onError: () => void): SkinnedMesh {
    const geometry = this.geometryBuilder.build(data)
    const material = this.materialBuilder
      .setCrossOrigin(this.crossOrigin)
      .setResourcePath(resourcePath)
      .build(data, geometry, onProgress, onError)

    const mesh = new SkinnedMesh(geometry, material)

    const skeleton = new Skeleton(initBones(mesh))
    mesh.bind(skeleton)

    // console.log( mesh ); // for console debug

    return mesh
  }

  setCrossOrigin(crossOrigin: string): this {
    this.crossOrigin = crossOrigin
    return this
  }
}
