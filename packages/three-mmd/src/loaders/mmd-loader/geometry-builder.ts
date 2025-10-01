import type {
  GroupMorph,
  Pmd,
  PmdConstraintInfo,
  PmdMorphInfo,
  PmdRigidBodyInfo,
  Pmx,
  PmxBoneInfo,
  PmxConstraintInfo,
  PmxMorphInfo,
  PmxRigidBodyInfo,
  VertexMorph,
} from '@noname0310/mmd-parser'

import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
} from 'three'

interface Bone {
  /** @remarks idk */
  grant?: GrantEntryParam
  /** @remarks idk */
  ik?: IK
  index: number
  name: PmxBoneInfo['name']
  parent: PmxBoneInfo['parentIndex']
  pos: [number, number, number]
  rigidBodyType: number
  rotq: [number, number, number, number]
  scl: [number, number, number]
  transformationClass?: PmxBoneInfo['transformationClass']
}

interface GrantEntry {
  children: GrantEntry[]
  param?: GrantEntryParam
  parent?: GrantEntry
  visited: boolean
}

interface GrantEntryParam extends NonNullable<PmxBoneInfo['grant']> {
  index: number
  transformationClass: PmxBoneInfo['transformationClass']
}

interface IK {
  effector: number
  iteration: number
  links: IKLink[]
  maxAngle: number
  target: number
}

interface IKLink {
  enabled: boolean
  index: number
  // PMD only
  limitation?: Vector3
  // PMX only
  rotationMax?: Vector3
  // PMX only
  rotationMin?: Vector3
}

export class GeometryBuilder {
  // TODO: remove class, convert to function
  /** @param data - parsed PMD/PMX data */
  build(data: Pmd | Pmx): BufferGeometry {
    // for geometry
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const skinIndices: number[] = []
    const skinWeights: number[] = []

    const indices: number[] = []

    const groups: { count: number, offset: number }[] = []

    const bones: Bone[] = []

    const morphTargets: { name: string }[] = []
    const morphPositions: Float32BufferAttribute[] = []

    const iks: IK[] = []
    const grants: GrantEntryParam[] = []

    const rigidBodies: (PmdRigidBodyInfo | PmxRigidBodyInfo)[] = []
    const constraints: (PmdConstraintInfo | PmxConstraintInfo)[] = []

    // for work
    let offset = 0
    const boneTypeTable: Record<number, number> = {}

    // positions, normals, uvs, skinIndices, skinWeights
    for (let i = 0; i < data.metadata.vertexCount; i++) {
      const v = data.vertices[i]

      for (let j = 0, jl = v.position.length; j < jl; j++) {
        positions.push(v.position[j])
      }

      for (let j = 0, jl = v.normal.length; j < jl; j++) {
        normals.push(v.normal[j])
      }

      for (let j = 0, jl = v.uv.length; j < jl; j++) {
        uvs.push(v.uv[j])
      }

      for (let j = 0; j < 4; j++) {
        skinIndices.push(v.skinIndices.length - 1 >= j ? v.skinIndices[j] : 0.0)
      }

      for (let j = 0; j < 4; j++) {
        skinWeights.push(v.skinWeights.length - 1 >= j ? v.skinWeights[j] : 0.0)
      }
    }

    // indices
    for (let i = 0; i < data.metadata.faceCount; i++) {
      const face = data.faces[i]

      for (let j = 0, jl = face.indices.length; j < jl; j++) {
        indices.push(face.indices[j])
      }
    }

    // groups
    for (let i = 0; i < data.metadata.materialCount; i++) {
      const material = data.materials[i]

      groups.push({
        count: material.faceCount * 3,
        offset: offset * 3,
      })

      offset += material.faceCount
    }

    // bones
    for (let i = 0; i < data.metadata.rigidBodyCount; i++) {
      const body = data.rigidBodies[i]
      let value = boneTypeTable[body.boneIndex]

      // keeps greater number if already value is set without any special reasons
      value = value == null ? body.type : Math.max(body.type, value)

      boneTypeTable[body.boneIndex] = value
    }

    for (let i = 0; i < data.metadata.boneCount; i++) {
      const boneData = data.bones[i]

      const bone = {
        index: i,
        name: boneData.name,
        parent: boneData.parentIndex,
        pos: boneData.position.slice(0, 3) as [number, number, number],
        rigidBodyType: boneTypeTable[i] != null ? boneTypeTable[i] : -1,
        rotq: [0, 0, 0, 1] as [number, number, number, number],
        scl: [1, 1, 1] as [number, number, number],
        transformationClass: 'transformationClass' in boneData
          ? boneData.transformationClass
          : undefined,
      }

      if (bone.parent !== -1) {
        bone.pos[0] -= data.bones[bone.parent].position[0]
        bone.pos[1] -= data.bones[bone.parent].position[1]
        bone.pos[2] -= data.bones[bone.parent].position[2]
      }

      bones.push(bone)
    }

    // iks
    // TODO: remove duplicated codes between PMD and PMX
    if (data.metadata.format === 'pmd') {
      for (let i = 0; i < data.metadata.ikCount; i++) {
        const ik = (data as Pmd).iks[i]

        const param: Partial<IK> = {
          effector: ik.effector,
          iteration: ik.iteration,
          links: [],
          maxAngle: ik.maxAngle * 4,
          target: ik.target,
        }

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link: Partial<IKLink> = {}
          link.index = ik.links[j].index
          link.enabled = true

          if (data.bones[link.index].name.includes('ひざ'))
            link.limitation = new Vector3(1.0, 0.0, 0.0)

          param.links!.push(link as IKLink)
        }

        iks.push(param as IK)
      }
    }
    else {
      for (let i = 0; i < data.metadata.boneCount; i++) {
        const { ik } = (data as Pmx).bones[i]

        if (ik === undefined)
          continue

        const param: Partial<IK> = {
          effector: ik.effector,
          iteration: ik.iteration,
          links: [],
          maxAngle: ik.maxAngle,
          target: i,
        }

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link: Partial<IKLink> = {}
          link.index = ik.links[j].index
          link.enabled = true

          if (ik.links[j].angleLimitation === 1) {
            // Revert if rotationMin/Max doesn't work well
            // link.limitation = new Vector3( 1.0, 0.0, 0.0 );
            // TODO: remove non-null assertion
            const rotationMin = ik.links[j].lowerLimitationAngle!
            const rotationMax = ik.links[j].upperLimitationAngle!

            // Convert Left to Right coordinate by myself because
            // MMDParser doesn't convert. It's a MMDParser's bug
            const tmp1 = -rotationMax[0]
            const tmp2 = -rotationMax[1]
            rotationMax[0] = -rotationMin[0]
            rotationMax[1] = -rotationMin[1]
            rotationMin[0] = tmp1
            rotationMin[1] = tmp2

            link.rotationMin = new Vector3().fromArray(rotationMin)
            link.rotationMax = new Vector3().fromArray(rotationMax)
          }

          param.links!.push(link as IKLink)
        }

        iks.push(param as IK)

        // Save the reference even from bone data for efficiently
        // simulating PMX animation system
        bones[i].ik = param as IK
      }
    }

    // grants
    if (data.metadata.format === 'pmx') {
      // bone index -> grant entry map
      const grantEntryMap: Record<number, GrantEntry> = {}

      for (let i = 0; i < data.metadata.boneCount; i++) {
        const boneData = data.bones[i] as PmxBoneInfo
        const { grant } = boneData

        if (grant === undefined)
          continue

        const param = {
          affectPosition: grant.affectPosition,
          affectRotation: grant.affectRotation,
          index: i,
          isLocal: grant.isLocal,
          parentIndex: grant.parentIndex,
          ratio: grant.ratio,
          transformationClass: boneData.transformationClass,
        }

        grantEntryMap[i] = { children: [], param, visited: false }
      }

      const rootEntry: GrantEntry = { children: [], visited: false }

      // Build a tree representing grant hierarchy
      for (const grantEntry of Object.values(grantEntryMap)) {
        const parentGrantEntry = grantEntry.param?.parentIndex != null
          ? grantEntryMap[grantEntry.param.parentIndex]
          : rootEntry

        grantEntry.parent = parentGrantEntry
        parentGrantEntry.children.push(grantEntry)
      }

      // Sort grant parameters from parents to children because
      // grant uses parent's transform that parent's grant is already applied
      // so grant should be applied in order from parents to children
      const traverse = (entry: GrantEntry) => {
        if (entry.param) {
          grants.push(entry.param)

          // Save the reference even from bone data for efficiently
          // simulating PMX animation system
          bones[entry.param.index].grant = entry.param
        }

        entry.visited = true

        for (let i = 0, il = entry.children.length; i < il; i++) {
          const child = entry.children[i]

          // Cut off a loop if exists. (Is a grant loop invalid?)
          if (!child.visited)
            traverse(child)
        }
      }

      traverse(rootEntry)
    }

    // morph
    const updateAttributes = (attribute: Float32BufferAttribute, morph: PmdMorphInfo | PmxMorphInfo, ratio: number) => {
      for (let i = 0; i < morph.elementCount; i++) {
        const element = morph.elements[i] as VertexMorph

        let index

        if (data.metadata.format === 'pmd') {
          index = data.morphs[0].elements[element.index].index
        }
        else {
          index = element.index
        }

        attribute.array[index * 3 + 0] += element.position[0] * ratio
        attribute.array[index * 3 + 1] += element.position[1] * ratio
        attribute.array[index * 3 + 2] += element.position[2] * ratio
      }
    }

    for (let i = 0; i < data.metadata.morphCount; i++) {
      const morph = data.morphs[i]
      const params = { name: morph.name }

      const attribute = new Float32BufferAttribute(data.metadata.vertexCount * 3, 3)
      attribute.name = morph.name

      for (let j = 0; j < data.metadata.vertexCount * 3; j++) {
        attribute.array[j] = positions[j]
      }

      if (data.metadata.format === 'pmd') {
        if (i !== 0) {
          updateAttributes(attribute, morph, 1.0)
        }
      }
      else {
        if (morph.type === 0) { // group
          for (let j = 0; j < morph.elementCount; j++) {
            const morph2 = data.morphs[morph.elements[j].index]
            const ratio = (morph.elements[j] as GroupMorph).ratio

            if (morph2.type === 1) { // vertex
              updateAttributes(attribute, morph2, ratio)
            }
            else {
              // TODO: implement
            }
          }
        }
        else if (morph.type === 1) { // vertex
          updateAttributes(attribute, morph, 1.0)
        }
        else if (morph.type === 2) { // bone
          // TODO: implement
        }
        else if (morph.type === 3) { // uv
          // TODO: implement
        }
        else if (morph.type === 4) { // additional uv1
          // TODO: implement
        }
        else if (morph.type === 5) { // additional uv2
          // TODO: implement
        }
        else if (morph.type === 6) { // additional uv3
          // TODO: implement
        }
        else if (morph.type === 7) { // additional uv4
          // TODO: implement
        }
        else if (morph.type === 8) { // material
          // TODO: implement
        }
      }

      morphTargets.push(params)
      morphPositions.push(attribute)
    }

    // rigid bodies from rigidBodies field.
    for (let i = 0; i < data.metadata.rigidBodyCount; i++) {
      const rigidBody = data.rigidBodies[i]
      const params = structuredClone(rigidBody)

      /*
       * RigidBody position parameter in PMX seems global position
       * while the one in PMD seems offset from corresponding bone.
       * So unify being offset.
       */
      if (data.metadata.format === 'pmx') {
        if (params.boneIndex !== -1) {
          const bone = data.bones[params.boneIndex]
          params.position[0] -= bone.position[0]
          params.position[1] -= bone.position[1]
          params.position[2] -= bone.position[2]
        }
      }

      rigidBodies.push(params)
    }

    // constraints from constraints field.
    for (let i = 0; i < data.metadata.constraintCount; i++) {
      const constraint = data.constraints[i]
      const params = structuredClone(constraint)

      const bodyA = rigidBodies[params.rigidBodyIndex1]
      const bodyB = rigidBodies[params.rigidBodyIndex2]

      // Refer to http://www20.atpages.jp/katwat/wp/?p=4135
      if (bodyA.type !== 0 && bodyB.type === 2) {
        if (bodyA.boneIndex !== -1 && bodyB.boneIndex !== -1
          && data.bones[bodyB.boneIndex].parentIndex === bodyA.boneIndex) {
          bodyB.type = 1
        }
      }

      constraints.push(params)
    }

    // build BufferGeometry.
    const geometry = new BufferGeometry()

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
    geometry.setIndex(indices)

    for (let i = 0, il = groups.length; i < il; i++) {
      geometry.addGroup(groups[i].offset, groups[i].count, i)
    }

    // TODO: idk
    (geometry as unknown as { bones: Bone[] }).bones = bones
    // TODO: idk
    ;(geometry as unknown as { morphTargets: { name: string }[] }).morphTargets = morphTargets
    geometry.morphAttributes.position = morphPositions
    geometry.morphTargetsRelative = false

    geometry.userData.MMD = {
      bones,
      constraints,
      format: data.metadata.format,
      grants,
      iks,
      rigidBodies,
    }

    geometry.computeBoundingSphere()

    return geometry
  }
}
