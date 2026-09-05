import type { Line } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  MeshBasicMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MMDIKHelper } from '../src/physics/mmd-ik-helper'
import { MMDIKSolver } from '../src/physics/mmd-ik-solver'
import { MMD } from '../src/utils/mmd'
import { MMDAnimationManager } from '../src/utils/mmd-animation-manager'
import { postParseProcessing } from '../src/utils/post-parse'

interface BoneSpec {
  appendTransform?: NonNullable<PmxObject.Bone['appendTransform']>
  flag?: number
  ik?: NonNullable<PmxObject['bones'][number]['ik']>
  name?: string
  parentBoneIndex?: number
  position?: [number, number, number]
  transformOrder?: number
}

const createRigidBody = (
  boneIndex: number,
  name: string,
): PmxObject.RigidBody => ({
  angularDamping: 0,
  boneIndex,
  collisionGroup: 0,
  collisionMask: 0,
  englishName: '',
  friction: 0,
  linearDamping: 0,
  mass: 1,
  name,
  physicsMode: PmxObject.RigidBody.PhysicsMode.Physics,
  repulsion: 0,
  shapePosition: [0, 0, 0],
  shapeRotation: [0, 0, 0],
  shapeSize: [1, 1, 1],
  shapeType: PmxObject.RigidBody.ShapeType.Sphere,
})

const createPmx = (
  specs: BoneSpec[],
  rigidBodies: PmxObject.RigidBody[] = [],
): PmxObject => {
  const zero: [number, number, number] = [0, 0, 0]
  const bones: PmxObject['bones'] = specs.map((spec, index) => ({
    appendTransform: spec.appendTransform,
    axisLimit: undefined,
    englishName: `bone-${index}`,
    externalParentTransform: undefined,
    flag: spec.flag ?? (spec.ik === undefined ? 0 : PmxObject.Bone.Flag.IsIkEnabled),
    ik: spec.ik,
    localVector: undefined,
    name: spec.name ?? `bone-${index}`,
    parentBoneIndex: spec.parentBoneIndex ?? -1,
    position: spec.position ?? [0, 0, 0],
    tailPosition: zero,
    transformOrder: spec.transformOrder ?? 0,
  }))

  return {
    bones,
    displayFrames: [],
    header: {
      additionalVec4Count: 0,
      boneIndexSize: 4,
      comment: '',
      encoding: PmxObject.Header.Encoding.Utf8,
      englishComment: '',
      englishModelName: '',
      materialIndexSize: 4,
      modelName: '',
      morphIndexSize: 4,
      rigidBodyIndexSize: 4,
      signature: 'PMX',
      textureIndexSize: 4,
      version: 2,
      vertexIndexSize: 4,
    },
    indices: new Uint8Array(),
    joints: [],
    materials: [],
    morphs: [],
    rigidBodies,
    softBodies: [],
    textures: [],
    vertices: [],
  }
}

const createMesh = (specs: BoneSpec[]) => {
  const bones = specs.map((spec, index) => {
    const bone = new Bone()
    bone.name = spec.name ?? `bone-${index}`
    const position = new Vector3().fromArray(spec.position ?? [0, 0, 0])
    const parentIndex = spec.parentBoneIndex ?? -1
    if (parentIndex >= 0)
      position.sub(new Vector3().fromArray(specs[parentIndex].position ?? [0, 0, 0]))
    bone.position.copy(position)
    return bone
  })

  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial())
  specs.forEach((spec, index) => {
    const parentIndex = spec.parentBoneIndex ?? -1
    if (parentIndex >= 0)
      bones[parentIndex].add(bones[index])
    else
      mesh.add(bones[index])
  })

  mesh.bind(new Skeleton(bones))
  mesh.updateMatrixWorld(true)
  return { bones, mesh }
}

const createSingleLinkSpecs = (
  limitation?: PmxObject.Bone.IKLink['limitation'],
): BoneSpec[] => [
  {
    ik: {
      iteration: 8,
      links: [{ limitation, target: 1 }],
      rotationConstraint: Math.PI,
      target: 2,
    },
    position: [0, 1, 0],
  },
  { position: [0, 0, 0] },
  { parentBoneIndex: 1, position: [1, 0, 0] },
]

const createAxisSpecs = (
  targetPosition: [number, number, number],
  effectorPosition: [number, number, number],
  limitation: PmxObject.Bone.IKLink['limitation'],
): BoneSpec[] => [
  {
    ik: {
      iteration: 8,
      links: [{ limitation, target: 1 }],
      rotationConstraint: Math.PI,
      target: 2,
    },
    position: targetPosition,
  },
  { position: [0, 0, 0] },
  { parentBoneIndex: 1, position: effectorPosition },
]

const closeTo = (actual: number, expected: number) =>
  expect(actual).toBeCloseTo(expected, 5)

describe('mmdIKSolver', () => {
  it('solves an unconstrained chain', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const solver = new MMDIKSolver(mesh, createPmx(specs))

    solver.update()

    const target = new Vector3().setFromMatrixPosition(bones[0].matrixWorld)
    const effector = new Vector3().setFromMatrixPosition(bones[2].matrixWorld)
    closeTo(target.distanceTo(effector), 0)
    closeTo(
      bones[1].quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2),
      ),
      0,
    )
  })

  it('creates and updates a disposable IK visualization helper', () => {
    const specs = createSingleLinkSpecs()
    const { mesh } = createMesh(specs)
    mesh.position.set(10, 20, 30)
    mesh.updateMatrixWorld(true)
    const solver = new MMDIKSolver(mesh, createPmx(specs))
    const helper = solver.createHelper(0.5)

    expect(helper).toBeInstanceOf(MMDIKHelper)
    expect(helper.root).toBe(mesh)
    expect(helper.sphereGeometry.parameters.radius).toBe(0.5)
    expect(helper.children).toHaveLength(4)

    helper.updateMatrixWorld(true)

    expect(helper.children[0].position.toArray()).toEqual([0, 1, 0])
    expect(helper.children[1].position.toArray()).toEqual([1, 0, 0])
    expect(helper.children[2].position.toArray()).toEqual([0, 0, 0])

    const line = helper.children[3] as Line<BufferGeometry>
    expect(Array.from(line.geometry.getAttribute('position').array)).toEqual([
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
    ])

    const disposeSphereGeometry = vi.spyOn(helper.sphereGeometry, 'dispose')
    const disposeLineGeometry = vi.spyOn(line.geometry, 'dispose')
    const disposeTargetMaterial = vi.spyOn(helper.targetSphereMaterial, 'dispose')
    helper.dispose()

    expect(disposeSphereGeometry).toHaveBeenCalledOnce()
    expect(disposeLineGeometry).toHaveBeenCalledOnce()
    expect(disposeTargetMaterial).toHaveBeenCalledOnce()
  })

  it('does not accumulate when update is called twice', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const solver = new MMDIKSolver(mesh, createPmx(specs))

    solver.update()
    const firstResult = bones[1].quaternion.clone()
    solver.update()

    closeTo(bones[1].quaternion.angleTo(firstResult), 0)
  })

  it('solves from a non-identity animated local rotation', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    bones[1].quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.25)
    mesh.updateMatrixWorld(true)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(
      bones[1].quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2),
      ),
      0,
    )
  })

  it('supports per-IK enable state', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const solver = new MMDIKSolver(mesh, createPmx(specs))

    expect(solver.isEnabled(0)).toBe(true)
    solver.setEnabled(0, false).update()

    closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
    expect(solver.isEnabled(0)).toBe(false)
    expect(() => solver.setEnabled(1, true)).toThrow(/does not contain an IK definition/)
  })

  it('does not rotate a fixed link', () => {
    const specs = createSingleLinkSpecs({
      maximumAngle: [0, 0, 0],
      minimumAngle: [0, 0, 0],
    })
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
  })

  it('normalizes reversed single-axis limits', () => {
    const specs = createSingleLinkSpecs({
      maximumAngle: [0, 0, -Math.PI],
      minimumAngle: [0, 0, Math.PI],
    })
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(
      bones[1].quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2),
      ),
      0,
    )
  })

  it.each([
    {
      axis: new Vector3(1, 0, 0),
      effector: [0, 1, 0] as [number, number, number],
      limitation: {
        maximumAngle: [Math.PI, 0, 0] as [number, number, number],
        minimumAngle: [-Math.PI, 0, 0] as [number, number, number],
      },
      name: 'X',
      target: [0, 0, 1] as [number, number, number],
    },
    {
      axis: new Vector3(0, 1, 0),
      effector: [0, 0, 1] as [number, number, number],
      limitation: {
        maximumAngle: [0, Math.PI, 0] as [number, number, number],
        minimumAngle: [0, -Math.PI, 0] as [number, number, number],
      },
      name: 'Y',
      target: [1, 0, 0] as [number, number, number],
    },
    {
      axis: new Vector3(0, 0, 1),
      effector: [1, 0, 0] as [number, number, number],
      limitation: {
        maximumAngle: [0, 0, Math.PI] as [number, number, number],
        minimumAngle: [0, 0, -Math.PI] as [number, number, number],
      },
      name: 'Z',
      target: [0, 1, 0] as [number, number, number],
    },
  ])('solves a $name-only link around its permitted axis', ({
    axis,
    effector,
    limitation,
    target,
  }) => {
    const specs = createAxisSpecs(target, effector, limitation)
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(
      bones[1].quaternion.angleTo(
        new Quaternion().setFromAxisAngle(axis, Math.PI / 2),
      ),
      0,
    )
  })

  it.each([
    {
      effector: [0, 1, 0] as [number, number, number],
      expectedAxis: new Vector3(1, 0, 0),
      limitation: {
        maximumAngle: [0.25, Math.PI, Math.PI] as [number, number, number],
        minimumAngle: [-0.25, -Math.PI, -Math.PI] as [number, number, number],
      },
      name: 'YXZ',
      target: [0, 0, 1] as [number, number, number],
    },
    {
      effector: [0, 0, 1] as [number, number, number],
      expectedAxis: new Vector3(0, 1, 0),
      limitation: {
        maximumAngle: [Math.PI, 0.25, Math.PI] as [number, number, number],
        minimumAngle: [-Math.PI, -0.25, -Math.PI] as [number, number, number],
      },
      name: 'ZYX',
      target: [1, 0, 0] as [number, number, number],
    },
    {
      effector: [1, 0, 0] as [number, number, number],
      expectedAxis: new Vector3(0, 0, 1),
      limitation: {
        maximumAngle: [Math.PI, Math.PI, 0.25] as [number, number, number],
        minimumAngle: [-Math.PI, -Math.PI, -0.25] as [number, number, number],
      },
      name: 'XZY',
      target: [0, 1, 0] as [number, number, number],
    },
  ])('clamps a general constraint using $name rotation order', ({
    effector,
    expectedAxis,
    limitation,
    target,
  }) => {
    const specs = createAxisSpecs(target, effector, limitation)
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(
      bones[1].quaternion.angleTo(
        new Quaternion().setFromAxisAngle(expectedAxis, 0.25),
      ),
      0,
    )
  })

  it('caps PMX iteration counts at 256', () => {
    const specs = createSingleLinkSpecs()
    specs[0].ik = {
      iteration: 1000,
      links: [{ limitation: undefined, target: 1 }],
      rotationConstraint: 0,
      target: 2,
    }
    const { bones, mesh } = createMesh(specs)
    const updateMatrixWorld = vi.spyOn(bones[1], 'updateMatrixWorld')

    new MMDIKSolver(mesh, createPmx(specs)).update()

    expect(updateMatrixWorld.mock.calls.length).toBeGreaterThanOrEqual(256)
    expect(updateMatrixWorld.mock.calls.length).toBeLessThan(300)
  })

  it('scales the per-step angle limit by chain depth', () => {
    const specs: BoneSpec[] = [
      {
        ik: {
          iteration: 1,
          links: [
            { limitation: undefined, target: 2 },
            { limitation: undefined, target: 1 },
          ],
          rotationConstraint: 0.1,
          target: 3,
        },
        position: [0, 2, 0],
      },
      { position: [0, 0, 0] },
      { parentBoneIndex: 1, position: [1, 0, 0] },
      { parentBoneIndex: 2, position: [2, 0, 0] },
    ]
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    closeTo(bones[2].quaternion.angleTo(new Quaternion()), 0.1)
    closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0.2)
  })

  it('orders IK definitions by transformOrder before bone index', () => {
    const sqrtHalf = Math.SQRT1_2
    const sharedIK = {
      iteration: 8,
      links: [{ limitation: undefined, target: 2 }],
      rotationConstraint: Math.PI,
      target: 3,
    }
    const specs: BoneSpec[] = [
      {
        ik: sharedIK,
        position: [0, 1, 0],
        transformOrder: 10,
      },
      {
        ik: sharedIK,
        position: [sqrtHalf, sqrtHalf, 0],
        transformOrder: 0,
      },
      { position: [0, 0, 0] },
      { parentBoneIndex: 2, position: [1, 0, 0] },
    ]
    const { bones, mesh } = createMesh(specs)

    new MMDIKSolver(mesh, createPmx(specs)).update()

    const finalEffectorPosition = new Vector3().setFromMatrixPosition(bones[3].matrixWorld)
    const finalTargetPosition = new Vector3().setFromMatrixPosition(bones[0].matrixWorld)
    closeTo(finalEffectorPosition.distanceTo(finalTargetPosition), 0)
  })

  it('skips an all-physics chain but solves a mixed chain', () => {
    const specs: BoneSpec[] = [
      {
        ik: {
          iteration: 8,
          links: [
            { limitation: undefined, target: 2 },
            { limitation: undefined, target: 1 },
          ],
          rotationConstraint: Math.PI,
          target: 3,
        },
        position: [0, 2, 0],
      },
      { position: [0, 0, 0] },
      { parentBoneIndex: 1, position: [1, 0, 0] },
      { parentBoneIndex: 2, position: [2, 0, 0] },
    ]

    {
      const { bones, mesh } = createMesh(specs)
      const rigidBodies = [
        createRigidBody(1, 'bone-1'),
        createRigidBody(2, 'bone-2'),
      ]
      new MMDIKSolver(mesh, createPmx(specs, rigidBodies)).update(0, true)

      closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
      closeTo(bones[2].quaternion.angleTo(new Quaternion()), 0)
    }

    {
      const { bones, mesh } = createMesh(specs)
      const rigidBodies = [createRigidBody(2, 'bone-2')]
      new MMDIKSolver(mesh, createPmx(specs, rigidBodies)).update(0, true)

      expect(bones[1].quaternion.angleTo(new Quaternion())).toBeGreaterThan(0.1)
      closeTo(bones[2].quaternion.angleTo(new Quaternion()), 0)
    }
  })

  it('uses the physics affectsIK capability from MMD', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs, [createRigidBody(1, 'bone-1')]), mesh)
    const updatePhysics = vi.fn()
    mmd.setPhysics(() => ({
      affectsIK: true,
      createHelper: <T>() => ({}) as T,
      update: updatePhysics,
    }))

    mmd.update(1 / 60)

    closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
    expect(updatePhysics).toHaveBeenCalledWith(1 / 60)
  })

  it.each([
    { grantAngle: Math.PI / 2, ikAngle: Math.PI / 2, options: {}, physicsCalls: 1 },
    { grantAngle: 0, ikAngle: 0, options: { ik: false }, physicsCalls: 1 },
    { grantAngle: 0, ikAngle: Math.PI / 2, options: { grant: false }, physicsCalls: 1 },
    { grantAngle: Math.PI / 2, ikAngle: Math.PI / 2, options: { physics: false }, physicsCalls: 0 },
  ])('respects independent stage options $options', ({ grantAngle, ikAngle, options, physicsCalls }) => {
    const specs = createSingleLinkSpecs()
    specs.push({
      appendTransform: { parentIndex: 1, ratio: 1 },
      flag: PmxObject.Bone.Flag.HasAppendRotate,
      transformOrder: 1,
    })
    const { bones, mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs), mesh)
    const updatePhysics = vi.fn()
    mmd.setPhysics(() => ({
      affectsIK: true,
      createHelper: <T>() => ({}) as T,
      update: updatePhysics,
    }))

    mmd.update(1 / 60, options)

    closeTo(bones[1].quaternion.angleTo(new Quaternion()), ikAngle)
    closeTo(bones[3].quaternion.angleTo(new Quaternion()), grantAngle)
    expect(updatePhysics).toHaveBeenCalledTimes(physicsCalls)
  })

  it('applies a grant on the IK goal before solving its chain', () => {
    const specs = createSingleLinkSpecs()
    specs[0].appendTransform = { parentIndex: 3, ratio: 1 }
    specs[0].flag = PmxObject.Bone.Flag.HasAppendMove | PmxObject.Bone.Flag.IsIkEnabled
    specs.push({})
    const { bones, mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs), mesh)
    bones[3].position.set(0, -2, 0)

    mmd.update(0)

    const effector = new Vector3().setFromMatrixPosition(bones[2].matrixWorld)
    closeTo(effector.distanceTo(new Vector3(0, -1, 0)), 0)
    // Restore the raw input before sampling each new animation frame.
    for (let i = 0; i < 3; i++) {
      mmd.beforeUpdate()
      closeTo(bones[0].position.y, 1)
      mmd.update(0)
      closeTo(bones[0].position.y, -1)
      closeTo(effector.setFromMatrixPosition(bones[2].matrixWorld).y, -1)
    }
  })

  it.each(['mixer', 'manager'])('restores constant animation tracks between %s frames', (mode) => {
    const specs = createSingleLinkSpecs()
    specs[0].appendTransform = { parentIndex: 3, ratio: 1 }
    specs[0].flag = PmxObject.Bone.Flag.HasAppendMove | PmxObject.Bone.Flag.IsIkEnabled
    specs.push({})
    const { bones, mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs), mesh)
    const clip = new AnimationClip('constant', 1, [
      new VectorKeyframeTrack('.bones[3].position', [0, 1], [0, -2, 0, 0, -2, 0]),
    ])
    const mixer = new AnimationMixer(mesh)
    const manager = new MMDAnimationManager()
    if (mode === 'mixer')
      mixer.clipAction(clip).play()
    else
      manager.add(mmd, { animation: clip })

    for (let frame = 0; frame < 3; frame++) {
      if (mode === 'mixer')
        mmd.updateWithMixer(1 / 60, mixer)
      else
        manager.update(1 / 60)
      closeTo(bones[0].position.y, -1)
      closeTo(new Vector3().setFromMatrixPosition(bones[2].matrixWorld).y, -1)
    }
  })

  it.each([-1, 0, 1])('interleaves a grant with IK at transform order %s', (transformOrder) => {
    const specs = createSingleLinkSpecs()
    specs.push({
      appendTransform: { parentIndex: 1, ratio: 1 },
      flag: PmxObject.Bone.Flag.HasAppendRotate,
      transformOrder,
    })
    const { bones, mesh } = createMesh(specs)
    new MMD(createPmx(specs), mesh).update(0)

    closeTo(bones[3].quaternion.angleTo(new Quaternion()), transformOrder < 0 ? 0 : Math.PI / 2)
  })

  it.each(['update', 'stages', 'manager'].flatMap(mode =>
    [true, false].map(physics => ({ mode, physics })),
  ))('evaluates after-physics bones through $mode with physics=$physics', ({ mode, physics }) => {
    const specs = createSingleLinkSpecs()
    specs[0].flag = PmxObject.Bone.Flag.IsIkEnabled | PmxObject.Bone.Flag.TransformAfterPhysics
    specs[0].transformOrder = -1
    specs.push({
      appendTransform: { parentIndex: 4, ratio: 1 },
      flag: PmxObject.Bone.Flag.HasAppendMove,
    }, {})
    specs.push({
      appendTransform: { parentIndex: 1, ratio: 1 },
      flag: PmxObject.Bone.Flag.HasAppendRotate | PmxObject.Bone.Flag.TransformAfterPhysics,
    })
    const { bones, mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs), mesh)
    bones[4].position.y = 2
    const updatePhysics = vi.fn(() => {
      closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
      closeTo(bones[3].position.y, 2)
      bones[0].position.set(0, -1, 0)
    })
    mmd.setPhysics(() => ({
      affectsIK: true,
      createHelper: <T>() => ({}) as T,
      update: updatePhysics,
    }))

    if (mode === 'stages') {
      mmd.beforePhysics({ physics })
      closeTo(bones[3].position.y, 2)
      closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
      expect(updatePhysics).not.toHaveBeenCalled()
      if (physics)
        mmd.physics!.update(1 / 60)
      mmd.afterPhysics({ physics })
    }
    else if (mode === 'manager') {
      const manager = new MMDAnimationManager()
      manager.add(mmd)
      manager.update(1 / 60, { physics })
    }
    else {
      mmd.update(1 / 60, { physics })
    }

    closeTo(new Vector3().setFromMatrixPosition(bones[2].matrixWorld).y, physics ? -1 : 1)
    closeTo(bones[5].quaternion.angleTo(bones[1].quaternion), 0)
    expect(updatePhysics).toHaveBeenCalledTimes(physics ? 1 : 0)
  })

  it('forwards update options and preserves updateWithMixer order', () => {
    const specs = createSingleLinkSpecs()
    const { mesh } = createMesh(specs)
    const mmd = new MMD(createPmx(specs), mesh)
    const calls: string[] = []
    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const mixer = {
      update: vi.fn(() => calls.push('mixer')),
    } as unknown as AnimationMixer
    const options = { grant: true, ik: false, physics: false }

    vi.spyOn(mmd, 'beforeUpdate').mockImplementation(() => calls.push('beforeUpdate'))
    const update = vi.spyOn(mmd, 'update').mockImplementation(() => calls.push('update'))

    mmd.updateWithMixer(1 / 60, mixer, options)

    expect(calls).toEqual(['beforeUpdate', 'mixer', 'update'])
    expect(update).toHaveBeenCalledWith(1 / 60, options)
  })

  it('resolves a physics bone by rigid body name when its index is invalid', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const rigidBodies = [createRigidBody(-1, 'bone-1')]

    new MMDIKSolver(mesh, createPmx(specs, rigidBodies)).update(0, true)

    closeTo(bones[1].quaternion.angleTo(new Quaternion()), 0)
  })

  it('does not treat FollowBone rigid bodies as physics-controlled IK links', () => {
    const specs = createSingleLinkSpecs()
    const { bones, mesh } = createMesh(specs)
    const rigidBody = {
      ...createRigidBody(1, 'bone-1'),
      physicsMode: PmxObject.RigidBody.PhysicsMode.FollowBone,
    }

    new MMDIKSolver(mesh, createPmx(specs, [rigidBody])).update(0, true)

    expect(bones[1].quaternion.angleTo(new Quaternion())).toBeGreaterThan(0.1)
  })

  it('rejects invalid indices and warns about unexpected topology', () => {
    const invalidSpecs = createSingleLinkSpecs()
    invalidSpecs[0].ik = {
      iteration: 1,
      links: [{ limitation: undefined, target: 9 }],
      rotationConstraint: 1,
      target: 2,
    }
    const { mesh: invalidMesh } = createMesh(invalidSpecs)
    expect(() => new MMDIKSolver(invalidMesh, createPmx(invalidSpecs)))
      .toThrow(/invalid IK link 0 for bone 0 index 9/)

    const topologySpecs = createSingleLinkSpecs()
    topologySpecs[2].parentBoneIndex = -1
    const { mesh: topologyMesh } = createMesh(topologySpecs)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const solver = new MMDIKSolver(topologyMesh, createPmx(topologySpecs))

    expect(solver.mesh).toBe(topologyMesh)
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('is not a direct child of IK link'),
    )
    warning.mockRestore()
  })

  it('rejects a skeleton with fewer bones than its PMX metadata', () => {
    const specs = createSingleLinkSpecs()
    const { mesh } = createMesh(specs.slice(0, 2))

    expect(() => new MMDIKSolver(mesh, createPmx(specs)))
      .toThrow(/skeleton has 2 bones, but PMX contains 3/)
  })
})

describe('postParseProcessing IK limitations', () => {
  it('converts limitation ranges to right-handed coordinates', () => {
    const specs = createSingleLinkSpecs({
      maximumAngle: [4, 5, 6],
      minimumAngle: [1, 2, 3],
    })
    const pmx = createPmx(specs)

    postParseProcessing(pmx)

    const limitation = pmx.bones[0].ik!.links[0].limitation!
    expect(limitation.minimumAngle).toEqual([-4, -5, 3])
    expect(limitation.maximumAngle).toEqual([-1, -2, 6])
  })

  it('converts SDEF centers and offsets to right-handed coordinates', () => {
    const pmx = {
      ...createPmx([]),
      vertices: [{
        additionalVec4: [],
        boneWeight: {
          boneIndices: [0, 1],
          boneWeights: {
            boneWeight0: 0.25,
            c: [1, 2, 3],
            r0: [4, 5, 6],
            r1: [7, 8, 9],
          },
        },
        edgeScale: 1,
        normal: [0, 1, 0],
        position: [0, 0, 0],
        uv: [0, 0],
        weightType: PmxObject.Vertex.BoneWeightType.Sdef,
      }],
    } as PmxObject

    postParseProcessing(pmx)

    const sdef = (pmx.vertices[0].boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>).boneWeights
    expect(sdef.c).toEqual([1, 2, -3])
    expect(sdef.r0).toEqual([4, 5, -6])
    expect(sdef.r1).toEqual([7, 8, -9])
  })
})
