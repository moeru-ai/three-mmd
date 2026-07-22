import type { VpdObject } from 'babylon-mmd/esm/Loader/Parser/vpdObject'

import { Quaternion, Vector3 } from 'three'

import type { MMD } from './mmd'

import { resetMMDAnimationPose } from './mmd'

export interface ApplyVPDOptions {
  grant?: boolean
  ik?: boolean
  resetPhysics?: boolean
  resetPose?: boolean
}

/**
 * Applies a static VPD pose to an MMD model.
 *
 * VPD uses MMD's coordinate system, so the pose is converted to the same
 * Three.js coordinate system used by VMD animation tracks before applying it.
 */
export const applyVPD = (
  mmd: MMD,
  vpd: VpdObject,
  options: ApplyVPDOptions = {},
) => {
  const {
    grant = true,
    ik = true,
    resetPhysics = true,
    resetPose = true,
  } = options
  const { mesh } = mmd

  // A previous VMD action may have cached a mixer pose. The static VPD pose
  // must replace it rather than be restored away on the next frame.
  resetMMDAnimationPose(mmd)

  if (resetPose)
    mesh.pose()

  const bonesByName = new Map(mesh.skeleton.bones.map(bone => [bone.name, bone]))
  const position = new Vector3()
  const rotation = new Quaternion()

  for (const [name, transform] of Object.entries(vpd.bones)) {
    const bone = bonesByName.get(name)
    if (bone === undefined)
      continue

    if (transform.position !== undefined) {
      position.set(
        transform.position[0],
        transform.position[1],
        -transform.position[2],
      )
      bone.position.add(position)
    }

    rotation.set(
      -transform.rotation[0],
      -transform.rotation[1],
      transform.rotation[2],
      transform.rotation[3],
    )
    bone.quaternion.multiply(rotation)
  }

  const morphTargetDictionary = mesh.morphTargetDictionary
  for (const [name, weight] of Object.entries(vpd.morphs)) {
    const index = morphTargetDictionary?.[name]
    if (index !== undefined)
      mesh.morphTargetInfluences![index] = weight
  }

  mesh.updateMatrixWorld(true)

  if (ik)
    mmd.ikSolver.update()

  if (grant)
    mmd.grantSolver.update()

  mesh.updateMatrixWorld(true)

  if (resetPhysics)
    mmd.physics?.reset?.()
}
