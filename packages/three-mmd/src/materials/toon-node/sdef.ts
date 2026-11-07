/* eslint-disable ts/unbound-method, @masknet/type-no-force-cast-via-top-type, ts/no-unsafe-argument, ts/no-unsafe-assignment, ts/no-unsafe-call, ts/no-unsafe-member-access, ts/no-unsafe-return, sonarjs/redundant-type-aliases */
// TSL's typings omit most vector swizzles and operators, so nodes are loosely typed in this file.

import type { BufferGeometry, SkinnedMesh } from 'three'
import type { NodeBuilder, NodeMaterial } from 'three/webgpu'

import {
  acos,
  attribute,
  Fn,
  If,
  mix,
  morphReference,
  normalLocal,
  positionLocal,
  reference,
  referenceBuffer,
  sin,
  skinning,
  subBuild,
  vec4,
} from 'three/tsl'

type N = any

const attr = (name: string, type: string): N => attribute(name, type)
const ref = (name: string, type: string): N => reference(name, type, undefined as never)

// TSL port of the SDEF GLSL in `../sdef.ts`. The GLSL `mat3`/`vec4` quaternion
// helpers become Fn()s with the same conventions (x, y, z, w with w scalar).
const rotationQuaternion = Fn(([matrix]: [N]) => {
  const column = (index: number) => (matrix).element(index).xyz.normalize()
  const x = column(0)
  const y = column(1)
  const z = column(2)
  const trace = x.x.add(y.y).add(z.z)
  const q: N = vec4().toVar()

  If(trace.greaterThan(0), () => {
    const s = trace.add(1).sqrt().mul(2)
    q.assign(vec4(y.z.sub(z.y).div(s), z.x.sub(x.z).div(s), x.y.sub(y.x).div(s), s.mul(0.25)))
  }).ElseIf(x.x.greaterThan(y.y).and(x.x.greaterThan(z.z)), () => {
    const s = x.x.sub(y.y).sub(z.z).add(1).max(0).sqrt().mul(2)
    q.assign(vec4(s.mul(0.25), x.y.add(y.x).div(s), x.z.add(z.x).div(s), y.z.sub(z.y).div(s)))
  }).ElseIf(y.y.greaterThan(z.z), () => {
    const s = y.y.sub(x.x).sub(z.z).add(1).max(0).sqrt().mul(2)
    q.assign(vec4(x.y.add(y.x).div(s), s.mul(0.25), y.z.add(z.y).div(s), z.x.sub(x.z).div(s)))
  }).Else(() => {
    const s = z.z.sub(x.x).sub(y.y).add(1).max(0).sqrt().mul(2)
    q.assign(vec4(x.z.add(z.x).div(s), y.z.add(z.y).div(s), s.mul(0.25), x.y.sub(y.x).div(s)))
  })

  return (q).normalize()
})

const slerp = Fn(([a, b, t]: [N, N, N]) => {
  const cosine = a.dot(b)
  const end = cosine.lessThan(0).select(b.negate(), b)
  const dot = cosine.abs().clamp(0, 1)
  const q: N = vec4().toVar()

  If(dot.greaterThan(0.9995), () => {
    q.assign((mix(a, end, t) as N).normalize())
  }).Else(() => {
    const angle = acos(dot)
    q.assign(a.mul(sin(t.oneMinus().mul(angle))).add(end.mul(sin(t.mul(angle)))).div(sin(angle)))
  })

  return q
})

const rotate = Fn(([q, v]: [N, N]) => v.add(q.xyz.cross(q.xyz.cross(v).add(v.mul(q.w))).mul(2)))

const sdefGeometries = new WeakMap<BufferGeometry, boolean>()

/** Whether the geometry has at least one SDEF vertex. Every MMD mesh carries the attributes, zeroed when unused. */
export const geometryHasSdef = (geometry: BufferGeometry): boolean => {
  let result = sdefGeometries.get(geometry)
  if (result === undefined) {
    result = geometry.hasAttribute('mmdSdefMask') && geometry.getAttribute('mmdSdefMask').array.some(value => value !== 0)
    sdefGeometries.set(geometry, result)
  }
  return result
}

/** Whether the mesh being built needs SDEF skinning. */
export const hasSdef = (builder: NodeBuilder): boolean => (
  (builder.object as SkinnedMesh).isSkinnedMesh === true && geometryHasSdef(builder.geometry)
)

/**
 * Replaces `NodeMaterial.setupPosition` for SDEF meshes: morph → skinning
 * (blending BDEF and SDEF per vertex) → position node.
 */
export const setupSdefPosition = (material: NodeMaterial, builder: NodeBuilder): N => {
  const { geometry } = builder
  const mesh = builder.object as SkinnedMesh

  if (geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color)
    morphReference(mesh)

  const restPosition: N = (positionLocal as N).toVar()
  const restNormal: N = (normalLocal as N).toVar()

  // Three's linear skinning writes positionLocal/normalLocal and registers the
  // skeleton update for this frame.
  skinning(mesh)

  const skinIndex = attr('skinIndex', 'uvec4')
  const skinWeight = attr('skinWeight', 'vec4')
  const bindMatrix = ref('bindMatrix', 'mat4')
  const bindMatrixInverse = ref('bindMatrixInverse', 'mat4')
  const boneMatrices: N = referenceBuffer('skeleton.boneMatrices', 'mat4', mesh.skeleton.bones.length, undefined as never)

  const bone0 = bindMatrixInverse.mul(boneMatrices.element(skinIndex.x)).mul(bindMatrix).toVar()
  const bone1 = bindMatrixInverse.mul(boneMatrices.element(skinIndex.y)).mul(bindMatrix).toVar()
  const rotation = slerp(rotationQuaternion(bone0), rotationQuaternion(bone1), skinWeight.y).toVar()

  const offset = bone0.mul(vec4(attr('mmdSdefRW0', 'vec3'), 1)).xyz.mul(skinWeight.x).add(bone1.mul(vec4(attr('mmdSdefRW1', 'vec3'), 1)).xyz.mul(skinWeight.y))
  const sdefPosition = rotate(rotation, restPosition.sub(attr('mmdSdefC', 'vec3'))).add(offset)
  const sdefNormal = rotate(rotation, restNormal)

  const isSdef = attr('mmdSdefMask', 'float').greaterThan(0.5)
  ;(positionLocal as N).assign(isSdef.select(sdefPosition, positionLocal))
  if (geometry.hasAttribute('normal'))
    (normalLocal as N).assign(isSdef.select(sdefNormal, normalLocal))

  if (material.positionNode !== null)
    (positionLocal as N).assign(subBuild(material.positionNode, 'POSITION', 'vec3'))

  return positionLocal
}

/**
 * The shadow pass renders with its own override material that knows nothing
 * about SDEF. Swaps its `setupPosition` while this mesh is drawn into the map.
 */
export const installSdefShadows = (mesh: SkinnedMesh): void => {
  let restore: (() => void) | undefined

  const previousBefore = mesh.onBeforeShadow
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, shadowMaterial, group) => {
    previousBefore.call(mesh, renderer, object, camera, shadowCamera, geometry, shadowMaterial, group)

    const material = shadowMaterial as unknown as NodeMaterial
    const original = material.setupPosition
    material.setupPosition = function (this: NodeMaterial, builder: NodeBuilder) {
      return hasSdef(builder) ? setupSdefPosition(this, builder) : original.call(this, builder)
    } as typeof original
    restore = () => {
      material.setupPosition = original
    }
  }

  const previousAfter = mesh.onAfterShadow
  mesh.onAfterShadow = (renderer, object, camera, shadowCamera, geometry, shadowMaterial, group) => {
    restore?.()
    restore = undefined
    previousAfter.call(mesh, renderer, object, camera, shadowCamera, geometry, shadowMaterial, group)
  }
}
