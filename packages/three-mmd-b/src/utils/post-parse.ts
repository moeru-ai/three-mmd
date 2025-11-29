
import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'

// Default post PMX parsing process: Z-flip
export const postParseProcessing = (pmx: PmxObject): PmxObject => {
  // Normalize to Three.js right-handed coordinates early.
  // Downstream builders (geometry/bones/morphs/rigid bodies) should not re-flip Z to avoid double transforms.

  // Vertices: position and normal
  pmx.vertices.forEach((v) => {
    v.position[2] = -v.position[2]
    v.normal[2] = -v.normal[2]
  })

  // Face winding (after Z flip)
  for (let i = 0; i < pmx.indices.length; i += 3) {
    const tmp = pmx.indices[i + 1]
    pmx.indices[i + 1] = pmx.indices[i + 2]
    pmx.indices[i + 2] = tmp
  }

  // Bones: position
  pmx.bones.forEach((bone) => {
    bone.position[2] = -bone.position[2]
  })

  // Morphs: vertex morph deltas
  pmx.morphs.forEach((morph) => {
    if (morph.type !== PmxObject.Morph.Type.VertexMorph)
      return

    for (let i = 0; i < morph.positions.length; i += 3)
      morph.positions[i + 2] = -morph.positions[i + 2]
  })

  // Rigid bodies: shape offsets
  pmx.rigidBodies?.forEach((body) => {
    body.shapePosition[2] = -body.shapePosition[2]
  })

  return pmx
}
