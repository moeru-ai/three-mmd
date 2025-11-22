import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

export type Grant = {
  index: number
  parentIndex: number
  ratio: number
  affectRotation: boolean
  affectPosition: boolean
  isLocal: boolean
  transformationClass?: number
}

export const buildGrants = (pmx: PmxObject): Grant[] => {
  type Entry = { param?: Grant; children: Entry[]; visited: boolean }
  const grantMap: Record<number, Entry> = {}

  pmx.bones.forEach((bone, i) => {
    const at = bone.appendTransform
    if (!at) return

    const flags = bone.flag
    const affectRotation = (flags & PmxObject.Bone.Flag.HasAppendRotate) !== 0
    const affectPosition = (flags & PmxObject.Bone.Flag.HasAppendMove) !== 0
    if (!affectRotation && !affectPosition) return
    const isLocal = (flags & PmxObject.Bone.Flag.LocalAppendTransform) !== 0

    const param: Grant = {
      index: i,
      parentIndex: at.parentIndex,
      ratio: at.ratio,
      affectRotation,
      affectPosition,
      isLocal,
      transformationClass: bone.transformOrder,
    }
    grantMap[i] = { param, children: [], visited: false }
  })

  const root: Entry = { children: [], visited: false }

  Object.values(grantMap).forEach((entry) => {
    if (!entry.param) return
    const parent = grantMap[entry.param.parentIndex] ?? root
    parent.children.push(entry)
  })

  const grants: Grant[] = []
  const walk = (e: Entry) => {
    if (e.visited) return
    e.visited = true
    if (e.param) grants.push(e.param)
    e.children.forEach(walk)
  }
  walk(root)

  return grants
}
