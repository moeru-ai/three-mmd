import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

export interface Grant {
  affectPosition: boolean
  affectRotation: boolean
  index: number
  isLocal: boolean
  parentIndex: number
  ratio: number
  transformationClass?: number
}

export const buildGrants = (pmx: PmxObject): Grant[] => {
  interface Entry { children: Entry[], param?: Grant, visited: boolean }
  const grantMap: Record<number, Entry> = {}

  pmx.bones.forEach((bone, i) => {
    const at = bone.appendTransform

    if (!at)
      return

    const flags = bone.flag
    const affectRotation = (flags & PmxObject.Bone.Flag.HasAppendRotate) !== 0
    const affectPosition = (flags & PmxObject.Bone.Flag.HasAppendMove) !== 0

    if (!affectRotation && !affectPosition)
      return

    const isLocal = (flags & PmxObject.Bone.Flag.LocalAppendTransform) !== 0

    const param: Grant = {
      affectPosition,
      affectRotation,
      index: i,
      isLocal,
      parentIndex: at.parentIndex,
      ratio: at.ratio,
      transformationClass: bone.transformOrder,
    }

    grantMap[i] = { children: [], param, visited: false }
  })

  const root: Entry = { children: [], visited: false }

  Object.values(grantMap).forEach((entry) => {
    if (!entry.param)
      return

    const parent = grantMap[entry.param.parentIndex] ?? root
    parent.children.push(entry)
  })

  const grants: Grant[] = []

  const walk = (e: Entry) => {
    if (e.visited)
      return

    e.visited = true

    if (e.param)
      grants.push(e.param)

    e.children.forEach(walk)
  }

  walk(root)

  return grants
}
