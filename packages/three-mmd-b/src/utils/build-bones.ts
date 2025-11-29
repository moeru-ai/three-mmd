/**
 * Build bone hierarchy from PMX data. Attaches child bones to parents and root bones to the mesh.
 * Note: currently expects pre-flipped Z coordinates; remove internal flips when postParseProcessing handles them.
 */
import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'

import { Bone, Skeleton } from 'three'

export const buildBones = (pmx: PmxObject, mesh: SkinnedMesh): SkinnedMesh => {
  // Bone geometry
  const bones = pmx.bones.map((boneInfo) => {
    const bone = new Bone()
    bone.name = boneInfo.name

    const pos = [...boneInfo.position] as [number, number, number]
    if (boneInfo.parentBoneIndex >= 0 && boneInfo.parentBoneIndex < pmx.bones.length) {
      const parentInfo = pmx.bones[boneInfo.parentBoneIndex]
      pos[0] -= parentInfo.position[0]
      pos[1] -= parentInfo.position[1]
      pos[2] -= parentInfo.position[2]
    }

    bone.position.fromArray(pos)
    return bone
  })
  // Parent-children bones hierarchy
  pmx.bones.forEach((boneInfo, i) => {
    if (boneInfo.parentBoneIndex >= 0 && boneInfo.parentBoneIndex < pmx.bones.length) {
      bones[boneInfo.parentBoneIndex].add(bones[i])
    }
    else {
      mesh.add(bones[i])
    }
  })

  mesh.updateMatrixWorld(true)

  // Bind bones to the mesh
  const skeleton = new Skeleton(bones)
  mesh.bind(skeleton)

  return mesh
}