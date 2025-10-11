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
    bone.position.fromArray(boneInfo.position)

    bones.push(bone)
  })
  pmx.bones.forEach(({ parentBoneIndex }, i) => {
    if (parentBoneIndex != null && parentBoneIndex !== -1 && bones.at(parentBoneIndex) != null)
      bones.at(parentBoneIndex)!.add(bones[i])
    else
      mesh.add(bones[i])
  })

  mesh.updateMatrixWorld(true)

  const skeleton = new Skeleton(bones)
  mesh.bind(skeleton)

  return mesh
}
