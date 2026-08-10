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
  const sdefMask = new Float32Array(vertexCount)
  const sdefC = new Float32Array(vertexCount * 3)
  const sdefRW0 = new Float32Array(vertexCount * 3)
  const sdefRW1 = new Float32Array(vertexCount * 3)

  pmx.vertices.forEach((v, i) => {
    const position = [v.position[0], v.position[1], v.position[2]]
    const normal = [v.normal[0], v.normal[1], v.normal[2]]
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
        const weight0 = sdefWeights.boneWeight0
        const weight1 = 1 - weight0
        skinWeights.set([weight0, weight1, 0, 0], i * 4)
        sdefMask[i] = 1
        sdefC.set(sdefWeights.c, i * 3)
        for (let axis = 0; axis < 3; axis++) {
          const center = sdefWeights.c[axis]
          const r0 = sdefWeights.r0[axis]
          const r1 = sdefWeights.r1[axis]
          const weightedR = r0 * weight0 + r1 * weight1

          // The shader consumes RW0/RW1, not the raw PMX R0/R1 values.
          sdefRW0[i * 3 + axis] = (center + center + r0 - weightedR) * 0.5
          sdefRW1[i * 3 + axis] = (center + center + r1 - weightedR) * 0.5
        }
        break
      }
    }
  })

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4))
  // These loader-owned attributes are consumed by the MMD SDEF shader patch.
  // They are present for every mesh so material variants can share one layout.
  geometry.setAttribute('mmdSdefMask', new BufferAttribute(sdefMask, 1))
  geometry.setAttribute('mmdSdefC', new BufferAttribute(sdefC, 3))
  geometry.setAttribute('mmdSdefRW0', new BufferAttribute(sdefRW0, 3))
  geometry.setAttribute('mmdSdefRW1', new BufferAttribute(sdefRW1, 3))

  const indices = Array.from(pmx.indices)
  geometry.setIndex(indices)

  let faceIndex = 0
  for (const material of pmx.materials) {
    geometry.addGroup(faceIndex, material.indexCount, pmx.materials.indexOf(material))
    faceIndex += material.indexCount
  }

  // Morph targets
  // const morphTargets: { name: string }[] = []
  const morphPositions: BufferAttribute[] = []

  const updateAttributes = (
    attribute: BufferAttribute,
    morph: PmxObject.Morph.VertexMorph,
    ratio: number,
  ) => {
    for (let i = 0; i < morph.indices.length; i++) {
      const index = morph.indices[i]
      attribute.array[index * 3 + 0] += morph.positions[i * 3 + 0] * ratio
      attribute.array[index * 3 + 1] += morph.positions[i * 3 + 1] * ratio
      attribute.array[index * 3 + 2] += morph.positions[i * 3 + 2] * ratio
    }
  }

  for (const morph of pmx.morphs) {
    // Keep every PMX morph in source order so Three.js numeric morph indices
    // match three-stdlib, even when this loader cannot evaluate the morph yet.
    const attribute = new BufferAttribute(positions.slice(), 3)
    attribute.name = morph.name

    if (morph.type === PmxObject.Morph.Type.GroupMorph) {
      for (let i = 0; i < morph.indices.length; i++) {
        const targetIndex = morph.indices[i]
        const ratio = morph.ratios[i]

        if (targetIndex < 0 || targetIndex >= pmx.morphs.length) {
          console.warn(`buildGeometry: Group morph "${morph.name}" references invalid morph index ${targetIndex}; skipping.`)
          continue
        }

        const targetMorph = pmx.morphs[targetIndex]

        // PMX does not support nesting group morphs. Treat malformed nesting as
        // recoverable model data instead of recursively applying it.
        if (targetMorph.type === PmxObject.Morph.Type.GroupMorph) {
          console.warn(`buildGeometry: Group morph "${morph.name}" references group morph index ${targetIndex}; skipping unsupported nesting.`)
          continue
        }

        if (targetMorph.type === PmxObject.Morph.Type.VertexMorph) {
          updateAttributes(attribute, targetMorph, ratio)
        }
      }
    }
    else if (morph.type === PmxObject.Morph.Type.VertexMorph) {
      updateAttributes(attribute, morph, 1.0)
    }
    // TODO: Evaluate bone/material morphs in an MMD pose controller, UV and
    // additional-UV morphs in the material shader, and PMX 2.1 flip/impulse
    // morphs in their respective runtime phases. Their slots intentionally
    // remain no-op position targets until those evaluators exist.

    morphPositions.push(attribute)
  }

  if (morphPositions.length > 0) {
    geometry.morphAttributes.position = morphPositions
    // geometry.morphTargets = morphTargets
    // TODO: Once a runtime morph controller owns non-vertex weights, remove
    // their GPU placeholder targets and evaluate a relative/sparse layout.
    geometry.morphTargetsRelative = false
  }

  geometry.computeBoundingSphere()

  return geometry
}
