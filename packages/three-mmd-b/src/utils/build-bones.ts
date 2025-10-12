import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'

import { Bone } from 'three'

export const buildBones = (pmx: PmxObject, mesh: SkinnedMesh): Bone[] => {
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
  pmx.bones.forEach((boneInfo, i) => {
    if (boneInfo.parentBoneIndex >= 0 && boneInfo.parentBoneIndex < pmx.bones.length)
      bones.at(boneInfo.parentBoneIndex)!.add(bones[i])
    else
      mesh.add(bones[i])
  })

  mesh.updateMatrixWorld(true)

  return bones
}
