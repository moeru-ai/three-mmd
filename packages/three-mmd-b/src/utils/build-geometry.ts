import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { BufferAttribute, BufferGeometry } from 'three'

export const buildGeometry = (pmx: PmxObject): BufferGeometry => {
  const geometry = new BufferGeometry()

  const vertexCount = pmx.vertices.length
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)

  const skinIndices = new Uint16Array(vertexCount * 4)
  const skinWeights = new Float32Array(vertexCount * 4)

  pmx.vertices.forEach((v, i) => { 
    // Need to fix the chirality of the model
    // Flip Z axis
    const position = [v.position[0], v.position[1], -v.position[2]]
    const normal = [v.normal[0], v.normal[1], -v.normal[2]]
    positions.set(position, i * 3)
    normals.set(normal, i * 3)
    uvs.set(v.uv, i * 2)

    switch (v.weightType) {
      case PmxObject.Vertex.BoneWeightType.Bdef1: {
        const bw = v.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef1>
        skinIndices.set([bw.boneIndices, 0, 0, 0], i * 4)
        skinWeights.set([1, 0, 0, 0], i * 4)
        break
      }
      case PmxObject.Vertex.BoneWeightType.Bdef2: {
        const bw = v.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2>
        skinIndices.set(bw.boneIndices, i * 4)
        skinWeights.set([bw.boneWeights, 1 - bw.boneWeights, 0, 0], i * 4)
        break
      }
      case PmxObject.Vertex.BoneWeightType.Bdef4:
      case PmxObject.Vertex.BoneWeightType.Qdef: { // QDEF is not supported, fallback to BDEF4
        const bw = v.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef4>
        skinIndices.set(bw.boneIndices, i * 4)
        skinWeights.set(bw.boneWeights, i * 4)
        break
      }
      case PmxObject.Vertex.BoneWeightType.Sdef: {
        const bw = v.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>
        skinIndices.set([bw.boneIndices[0], bw.boneIndices[1], 0, 0], i * 4)
        const sdefWeights = bw.boneWeights
        skinWeights.set([sdefWeights.boneWeight0, 1 - sdefWeights.boneWeight0, 0, 0], i * 4)
      }
    }
  })

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4))

  // Need to flip the face winding order
   const indices = Array.from(pmx.indices)
  for (let i = 0; i < indices.length; i += 3) {
    const tmp = indices[i + 1]
    indices[i + 1] = indices[i + 2]
    indices[i + 2] = tmp
  }
  geometry.setIndex(indices)

  let faceIndex = 0
  for (const material of pmx.materials) {
    geometry.addGroup(faceIndex, material.indexCount, pmx.materials.indexOf(material))
    faceIndex += material.indexCount
  }

  // Morph targets
  // const morphTargets: { name: string }[] = []
  const morphPositions: BufferAttribute[] = []

  const updateAttributes = (attribute: BufferAttribute, morph: PmxObject.Morph, ratio: number) => {
    if (morph.type !== PmxObject.Morph.Type.VertexMorph)
      return

    for (let i = 0; i < morph.indices.length; i++) {
      const index = morph.indices[i]
      attribute.array[index * 3 + 0] += morph.positions[i * 3 + 0] * ratio
      attribute.array[index * 3 + 1] += morph.positions[i * 3 + 1] * ratio
      // Flip Z axis
      // Lilia: this part may need to be tested when build-animation is available
      attribute.array[index * 3 + 2] -= morph.positions[i * 3 + 2] * ratio
    }
  }

  for (const morph of pmx.morphs) {
    if (
      morph.type !== PmxObject.Morph.Type.VertexMorph
      && morph.type !== PmxObject.Morph.Type.GroupMorph
    ) {
      continue
    }

    // morphTargets.push({ name: morph.name })
    const attribute = new BufferAttribute(positions.slice(), 3)
    attribute.name = morph.name

    if (morph.type === PmxObject.Morph.Type.GroupMorph) {
      for (let i = 0; i < morph.indices.length; i++) {
        const targetMorph = pmx.morphs[morph.indices[i]]
        const ratio = morph.ratios[i]

        if (targetMorph.type === PmxObject.Morph.Type.VertexMorph) {
          updateAttributes(attribute, targetMorph, ratio)
        }
      }
    }
    else { // VertexMorph
      updateAttributes(attribute, morph, 1.0)
    }

    morphPositions.push(attribute)
  }

  if (morphPositions.length > 0) {
    geometry.morphAttributes.position = morphPositions
    // geometry.morphTargets = morphTargets
    geometry.morphTargetsRelative = false
  }

  geometry.computeBoundingSphere()

  return geometry
}
