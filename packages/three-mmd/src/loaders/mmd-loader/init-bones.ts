import type { SkinnedMesh } from 'three'

import { Bone } from 'three'

// TODO: Try to remove this function
export const initBones = (mesh: SkinnedMesh): Bone[] => {
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
