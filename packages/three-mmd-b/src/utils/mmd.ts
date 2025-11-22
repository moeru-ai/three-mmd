import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { VRMSpringBoneManager } from '@pixiv/three-vrm-springbone'

import type { Grant } from './build-grants'

import { buildGrants } from './build-grants'
import { buildIK } from './build-ik'
import { buildMesh } from './build-mesh'

export class MMD {
  public grants: Grant[]
  public iks: IK[]
  public mesh: SkinnedMesh

  private springBoneManager: VRMSpringBoneManager

  constructor(pmx: PmxObject, resourcePath: string) {
    this.grants = buildGrants(pmx)
    this.iks = buildIK(pmx)
    this.mesh = buildMesh(pmx, resourcePath)

    this.springBoneManager = new VRMSpringBoneManager()
  }

  public update(delta: number) {
    this.springBoneManager.update(delta)
  }
}
