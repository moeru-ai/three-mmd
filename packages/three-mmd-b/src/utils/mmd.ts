import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { VRMSpringBoneJoint, VRMSpringBoneJointHelper, VRMSpringBoneManager } from '@pixiv/three-vrm-springbone'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

export class MMD {
  public grants: Grant[]
  public iks: IK[]
  public mesh: SkinnedMesh

  public springBoneManager: VRMSpringBoneManager

  private joints: VRMSpringBoneJoint[] = []

  constructor(pmx: PmxObject, resourcePath: string) {
    this.grants = buildGrants(pmx)
    this.iks = buildIK(pmx)
    this.mesh = buildMesh(pmx, resourcePath)

    this.springBoneManager = new VRMSpringBoneManager()

    // console.log(this.mesh.skeleton.bones.map(bone => bone.name))

    this.mesh.skeleton.bones
      .filter(bone => ['髪', 'Hair', 'Twin'].some(v => bone.name.includes(v)))
      .forEach(bone => bone.children.forEach(childBone =>
        this.joints.push(new VRMSpringBoneJoint(bone, childBone, {
          dragForce: 0.4,
          gravityPower: 0.1,
          hitRadius: 0.02,
          stiffness: 1.0,
        })),
      ))

    this.joints.forEach(j => this.springBoneManager.addJoint(j))

    this.mesh.updateMatrixWorld(true)
    this.springBoneManager.setInitState()
  }

  public createHelper(): VRMSpringBoneJointHelper[] {
    const helpers: VRMSpringBoneJointHelper[] = []

    this.joints.forEach(j => helpers.push(new VRMSpringBoneJointHelper(j)))

    return helpers
  }

  public update(delta: number) {
    this.springBoneManager.update(delta)
  }
}
