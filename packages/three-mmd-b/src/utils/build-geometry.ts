import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three'

/** @experimental */
export const buildGeometry = (pmx: PmxObject): BufferGeometry => {
  const geometry = new BufferGeometry()

  const getIndices = () => {
    const indices: number[] = []

    for (let i = 0; i < pmx.indices.length; i += 3) { // reverse winding order
      indices[i + 0] = pmx.indices[i + 0]
      indices[i + 1] = pmx.indices[i + 2]
      indices[i + 2] = pmx.indices[i + 1]
    }

    return indices
  }

  const getAttributes = () => {
    const { vertices } = pmx
    const vertexCount = vertices.length
    // const additionalUvs: Float32Array[] = []

    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const boneIndices = new Float32Array(vertexCount * 4)
    const boneWeights = new Float32Array(vertexCount * 4)

    for (let vertexIndex = 0; vertexIndex < vertexCount; ++vertexIndex) {
      const vertex = vertices[vertexIndex]

      positions[vertexIndex * 3 + 0] = vertex.position[0]
      positions[vertexIndex * 3 + 1] = vertex.position[1]
      positions[vertexIndex * 3 + 2] = vertex.position[2]

      normals[vertexIndex * 3 + 0] = vertex.normal[0]
      normals[vertexIndex * 3 + 1] = vertex.normal[1]
      normals[vertexIndex * 3 + 2] = vertex.normal[2]

      uvs[vertexIndex * 2 + 0] = vertex.uv[0]
      uvs[vertexIndex * 2 + 1] = 1 - vertex.uv[1] // flip y axis

      // const additionalVec4 = vertex.additionalVec4;
      // for (let k = 0; k < additionalUvs.length; ++k) {
      //   additionalUvs[k][vertexIndex * 4 + 0] = additionalVec4[k][0];
      //   additionalUvs[k][vertexIndex * 4 + 1] = additionalVec4[k][1];
      //   additionalUvs[k][vertexIndex * 4 + 2] = additionalVec4[k][2];
      //   additionalUvs[k][vertexIndex * 4 + 3] = additionalVec4[k][3];
      // }

      switch (vertex.weightType) {
        case PmxObject.Vertex.BoneWeightType.Bdef1:
          {
            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef1>

            boneIndices[vertexIndex * 4 + 0] = boneWeight.boneIndices
            boneIndices[vertexIndex * 4 + 1] = 0
            boneIndices[vertexIndex * 4 + 2] = 0
            boneIndices[vertexIndex * 4 + 3] = 0

            boneWeights[vertexIndex * 4 + 0] = 1
            boneWeights[vertexIndex * 4 + 1] = 0
            boneWeights[vertexIndex * 4 + 2] = 0
            boneWeights[vertexIndex * 4 + 3] = 0
          }
          break

        case PmxObject.Vertex.BoneWeightType.Bdef2:
          {
            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2>

            boneIndices[vertexIndex * 4 + 0] = boneWeight.boneIndices[0]
            boneIndices[vertexIndex * 4 + 1] = boneWeight.boneIndices[1]
            boneIndices[vertexIndex * 4 + 2] = 0
            boneIndices[vertexIndex * 4 + 3] = 0

            boneWeights[vertexIndex * 4 + 0] = boneWeight.boneWeights
            boneWeights[vertexIndex * 4 + 1] = 1 - boneWeight.boneWeights
            boneWeights[vertexIndex * 4 + 2] = 0
            boneWeights[vertexIndex * 4 + 3] = 0
          }
          break

        case PmxObject.Vertex.BoneWeightType.Bdef4:
        case PmxObject.Vertex.BoneWeightType.Qdef: // pmx 2.1 not support fallback to bdef4
          {
            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef4>

            boneIndices[vertexIndex * 4 + 0] = boneWeight.boneIndices[0]
            boneIndices[vertexIndex * 4 + 1] = boneWeight.boneIndices[1]
            boneIndices[vertexIndex * 4 + 2] = boneWeight.boneIndices[2]
            boneIndices[vertexIndex * 4 + 3] = boneWeight.boneIndices[3]

            boneWeights[vertexIndex * 4 + 0] = boneWeight.boneWeights[0]
            boneWeights[vertexIndex * 4 + 1] = boneWeight.boneWeights[1]
            boneWeights[vertexIndex * 4 + 2] = boneWeight.boneWeights[2]
            boneWeights[vertexIndex * 4 + 3] = boneWeight.boneWeights[3]
          }
          break

        case PmxObject.Vertex.BoneWeightType.Sdef:
          {
            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>

            boneIndices[vertexIndex * 4 + 0] = boneWeight.boneIndices[0]
            boneIndices[vertexIndex * 4 + 1] = boneWeight.boneIndices[1]
            boneIndices[vertexIndex * 4 + 2] = 0
            boneIndices[vertexIndex * 4 + 3] = 0

            const sdefWeights = boneWeight.boneWeights
            const boneWeight0 = sdefWeights.boneWeight0
            const boneWeight1 = 1 - boneWeight0

            boneWeights[vertexIndex * 4 + 0] = boneWeight0
            boneWeights[vertexIndex * 4 + 1] = boneWeight1
            boneWeights[vertexIndex * 4 + 2] = 0
            boneWeights[vertexIndex * 4 + 3] = 0
          }
          break
      }
    }

    return { boneIndices, boneWeights, normals, positions, uvs }
  }

  const { boneIndices, boneWeights, normals, positions, uvs } = getAttributes()
  const indices = getIndices()

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(boneIndices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(boneWeights, 4))
  geometry.setIndex(indices)

  // groups
  const groups = []
  let offset = 0
  for (let i = 0; i < pmx.materials.length; i++) {
    const material = pmx.materials[i]

    groups.push({
      count: material.indexCount * 3,
      offset: offset * 3,
    })

    offset += material.indexCount
  }

  for (let i = 0, il = groups.length; i < il; i++) {
    geometry.addGroup(groups[i].offset, groups[i].count, i)
  }

  // geometry.morphAttributes.position = morphPositions

  // false is default
  // geometry.morphTargetsRelative = false

  geometry.userData.MMD = {
    // bones: pmx.bones,
    // bones,
    // constraints,
    // format: data.metadata.format,
    // grants,
    // iks,
    // rigidBodies,
  }

  geometry.computeBoundingSphere()

  return geometry
}
