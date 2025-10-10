import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

import { Bone, MeshNormalMaterial, Skeleton, SkinnedMesh } from 'three'

import { buildGeometry } from './build-geometry'

/** @experimental */
export const buildMesh = (pmx: PmxObject): SkinnedMesh => {
  const geometry = buildGeometry(pmx)

  const mesh = new SkinnedMesh(geometry, new MeshNormalMaterial())

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
