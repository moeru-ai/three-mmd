import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { IK } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { Vector3 } from 'three'

export const buildIK = (pmx: PmxObject): IK[] => {
  const iks: IK[] = []

  // Traverse bones to find IK settings
  for (const [index, { ik }] of pmx.bones.entries()) {
    if (ik === undefined)
      continue
    const param: IK = {
      effector: ik.target,
      iteration: ik.iteration,
      links: [],
      maxAngle: ik.rotationConstraint > 0 ? ik.rotationConstraint : undefined,
      target: index,
    }

    const links: IK['links'] = ik.links.map((link) => {
      const result: IK['links'][number] = {
        enabled: true,
        index: link.target,
      }

      const boneName = pmx.bones[link.target].name
      if (boneName.includes('ひざ')) {
        result.limitation = new Vector3(1, 0, 0)
      }
      else if (link.limitation) {
        const rotationMin = link.limitation.minimumAngle
        const rotationMax = link.limitation.maximumAngle

        // Convert Left to Right coordinate by myself because
        // MMDParser doesn't convert. It's a MMDParser's bug
        // const tmp1 = -rotationMax[0]
        // const tmp2 = -rotationMax[1]
        // rotationMax[0] = -rotationMin[0]
        // rotationMax[1] = -rotationMin[1]
        // rotationMin[0] = tmp1
        // rotationMin[1] = tmp2

        result.rotationMin = new Vector3().fromArray(rotationMin)
        result.rotationMax = new Vector3().fromArray(rotationMax)
      }

      return result
    })

    iks.push({
      ...param,
      links,
    })
  }

  return iks
}
