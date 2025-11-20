import type { PmxBoneInfo } from '@noname0310/mmd-parser'
import type { Bone, SkinnedMesh } from 'three'

import { Quaternion } from 'three'

export interface Grant extends NonNullable<PmxBoneInfo['grant']> {
  index: number
}

/**
 * Solver for Grant (Fuyo in Japanese. I just google translated because
 * Fuyo may be MMD specific term and may not be common word in 3D CG terms.)
 * Grant propagates a bone's transform to other bones transforms even if
 * they are not children.
 */
export class GrantSolver {
  grants: Grant[]
  mesh: SkinnedMesh

  private q = new Quaternion()

  constructor(mesh: SkinnedMesh, grants: Grant[] = []) {
    this.mesh = mesh
    this.grants = grants
  }

  addGrantRotation(bone: Bone, q: Quaternion, ratio: number) {
    this.q.set(0, 0, 0, 1)
    this.q.slerp(q, ratio)
    bone.quaternion.multiply(this.q)

    return this
  }

  update() {
    const grants = this.grants

    for (let i = 0, il = grants.length; i < il; i++) {
      this.updateOne(grants[i])
    }

    return this
  }

  updateOne(grant: Grant) {
    const bones = this.mesh.skeleton.bones
    const bone = bones[grant.index]
    const parentBone = bones[grant.parentIndex]

    if (grant.isLocal) {
      // TODO: implement
      // if (grant.affectPosition) {

      // }

      // TODO: implement
      // if (grant.affectRotation) {

      // }
    }
    else {
      // TODO: implement
      // if (grant.affectPosition) {

      // }

      if (grant.affectRotation) {
        this.addGrantRotation(bone, parentBone.quaternion, grant.ratio)
      }
    }

    return this
  }
}
