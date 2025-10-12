import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

import {
  Bone,
  Skeleton,
  SkinnedMesh,
} from 'three'

import { buildGeometry } from './build-geometry'
import { buildMaterial } from './build-material'

/** @experimental */
export const buildMesh = (
  pmx: PmxObject,
  resourcePath: string,
): SkinnedMesh => {
  const geometry = buildGeometry(pmx)
  const material = buildMaterial(
    pmx,
    geometry,
    resourcePath,
  )

  const mesh = new SkinnedMesh(geometry, material)

  // bones
  const bones: Bone[] = []
  pmx.bones.forEach((boneInfo) => {
    const bone = new Bone()

    bone.name = boneInfo.name

    const { position } = boneInfo
    if (boneInfo.parentBoneIndex >= 0 && boneInfo.parentBoneIndex < pmx.bones.length) {
      position[0] -= pmx.bones[boneInfo.parentBoneIndex].position[0]
      position[1] -= pmx.bones[boneInfo.parentBoneIndex].position[1]
      position[2] -= pmx.bones[boneInfo.parentBoneIndex].position[2]
    }
    bone.position.fromArray(position)

    bones.push(bone)
  })
  pmx.bones.forEach(({ parentBoneIndex }, i) => {
    if (parentBoneIndex != null && parentBoneIndex !== -1 && bones.at(parentBoneIndex) != null)
      bones.at(parentBoneIndex)!.add(bones[i])
    else
      mesh.add(bones[i])
  })
  // mesh.add(...bones)

  mesh.updateMatrixWorld(true)

  const skeleton = new Skeleton(bones)
  mesh.bind(skeleton)

  return mesh
}
