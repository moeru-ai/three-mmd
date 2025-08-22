import type { Pmd, Pmx } from '@noname0310/mmd-parser'

import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
} from 'three'

export class GeometryBuilder {
  build(data: Pmd | Pmx): BufferGeometry {
    // for geometry
    const positions = []
    const uvs = []
    const normals = []

    const indices = []

    const groups = []

    const bones = []
    const skinIndices = []
    const skinWeights = []

    const morphTargets = []
    const morphPositions = []

    const iks = []
    const grants = []

    const rigidBodies = []
    const constraints = []

    // for work
    let offset = 0
    const boneTypeTable = {}

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
      value = value === undefined ? body.type : Math.max(body.type, value)

      boneTypeTable[body.boneIndex] = value
    }

    for (let i = 0; i < data.metadata.boneCount; i++) {
      const boneData = data.bones[i]

      const bone = {
        index: i,
        name: boneData.name,
        parent: boneData.parentIndex,
        pos: boneData.position.slice(0, 3),
        rigidBodyType: boneTypeTable[i] !== undefined ? boneTypeTable[i] : -1,
        rotq: [0, 0, 0, 1],
        scl: [1, 1, 1],
        transformationClass: boneData.transformationClass,
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
        const ik = data.iks[i]

        const param = {
          effector: ik.effector,
          iteration: ik.iteration,
          links: [],
          maxAngle: ik.maxAngle * 4,
          target: ik.target,
        }

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link = {}
          link.index = ik.links[j].index
          link.enabled = true

          if (data.bones[link.index].name.includes('ひざ')) {
            link.limitation = new Vector3(1.0, 0.0, 0.0)
          }

          param.links.push(link)
        }

        iks.push(param)
      }
    }
    else {
      for (let i = 0; i < data.metadata.boneCount; i++) {
        const ik = data.bones[i].ik

        if (ik === undefined)
          continue

        const param = {
          effector: ik.effector,
          iteration: ik.iteration,
          links: [],
          maxAngle: ik.maxAngle,
          target: i,
        }

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link = {}
          link.index = ik.links[j].index
          link.enabled = true

          if (ik.links[j].angleLimitation === 1) {
            // Revert if rotationMin/Max doesn't work well
            // link.limitation = new Vector3( 1.0, 0.0, 0.0 );

            const rotationMin = ik.links[j].lowerLimitationAngle
            const rotationMax = ik.links[j].upperLimitationAngle

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

          param.links.push(link)
        }

        iks.push(param)

        // Save the reference even from bone data for efficiently
        // simulating PMX animation system
        bones[i].ik = param
      }
    }

    // grants

    if (data.metadata.format === 'pmx') {
      // bone index -> grant entry map
      const grantEntryMap = {}

      for (let i = 0; i < data.metadata.boneCount; i++) {
        const boneData = data.bones[i]
        const grant = boneData.grant

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

        grantEntryMap[i] = { children: [], param, parent: null, visited: false }
      }

      const rootEntry = { children: [], param: null, parent: null, visited: false }

      // Build a tree representing grant hierarchy

      for (const boneIndex in grantEntryMap) {
        const grantEntry = grantEntryMap[boneIndex]
        const parentGrantEntry = grantEntryMap[grantEntry.parentIndex] || rootEntry

        grantEntry.parent = parentGrantEntry
        parentGrantEntry.children.push(grantEntry)
      }

      // Sort grant parameters from parents to children because
      // grant uses parent's transform that parent's grant is already applied
      // so grant should be applied in order from parents to children

      function traverse(entry) {
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

    function updateAttributes(attribute, morph, ratio) {
      for (let i = 0; i < morph.elementCount; i++) {
        const element = morph.elements[i]

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
            const ratio = morph.elements[j].ratio

            if (morph2.type === 1) {
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
      const params = {}

      for (const key in rigidBody) {
        params[key] = rigidBody[key]
      }

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
      const params = {}

      for (const key in constraint) {
        params[key] = constraint[key]
      }

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

    geometry.bones = bones

    geometry.morphTargets = morphTargets
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
