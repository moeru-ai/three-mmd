import { PmxObject } from '@moeru/three-mmd'
import { Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MmdAmmoPhysicsModel } from '../src/mmd-ammo-physics-model'

const setPrivate = (target: object, key: string, value: unknown) => {
  Reflect.set(target, key, value)
}

const callPrivate = <TArgs extends unknown[], TResult>(
  target: object,
  key: string,
  ...args: TArgs
): TResult => {
  const method = Reflect.get(target, key) as (
    this: object,
    ...args: TArgs
  ) => TResult
  return method.call(target, ...args)
}

describe('mmdAmmoPhysicsModel', () => {
  it('maps an unscaled body transform into the rendered root space', () => {
    const model = Object.create(
      MmdAmmoPhysicsModel.prototype,
    ) as MmdAmmoPhysicsModel
    const mesh = new SkinnedMesh()
    mesh.position.set(0, -10, 0)
    mesh.scale.setScalar(0.1)
    mesh.updateMatrixWorld(true)
    setPrivate(model, 'mmd', { mesh })
    setPrivate(model, 'inversePhysicsRootMatrix', new Matrix4())
    setPrivate(model, 'inverseRootMatrix', new Matrix4())
    setPrivate(model, 'physicsRootMatrix', new Matrix4())
    setPrivate(model, 'rootQuaternion', new Quaternion())
    setPrivate(model, 'temporaryPosition', new Vector3())
    setPrivate(model, 'temporaryQuaternion', new Quaternion())
    setPrivate(model, 'temporaryScale', new Vector3())
    const transform = {
      getOrigin: () => ({ x: () => 2, y: () => -7, z: () => 4 }),
      getRotation: () => ({ w: () => 1, x: () => 0, y: () => 0, z: () => 0 }),
    }

    const rendered = model.getBodyRenderMatrix(
      { body: { getWorldTransform: () => transform } } as never,
      new Matrix4(),
    )
    const position = new Vector3()
    const scale = new Vector3()
    rendered.decompose(position, new Quaternion(), scale)

    expect(position.toArray()).toEqual([0.2, -9.7, 0.4])
    expect(scale.toArray()).toEqual([0.1, 0.1, 0.1])
  })

  it('builds body offsets from the inverse bind matrix', () => {
    const model = Object.create(
      MmdAmmoPhysicsModel.prototype,
    ) as MmdAmmoPhysicsModel
    const inverseBindMatrix = new Matrix4().makeTranslation(-1, -2, -3)
    const shapeModelTransform = new Matrix4().makeTranslation(4, 5, 6)
    setPrivate(model, 'mmd', {
      mesh: {
        bindMatrix: new Matrix4(),
        skeleton: { boneInverses: [inverseBindMatrix] },
      },
    })

    const result = callPrivate<[number, Matrix4, Matrix4], Matrix4>(
      model,
      'getBodyOffsetFromBindPose',
      0,
      shapeModelTransform,
      new Matrix4(),
    )

    expect(new Vector3().setFromMatrixPosition(result).toArray())
      .toEqual([3, 3, 3])
  })

  it('uses Babylon-compatible YXZ Euler order for rigid body transforms', () => {
    const model = Object.create(
      MmdAmmoPhysicsModel.prototype,
    ) as MmdAmmoPhysicsModel
    setPrivate(model, 'temporaryPosition', new Vector3())
    setPrivate(model, 'temporaryQuaternion', new Quaternion())
    setPrivate(model, 'temporaryScale', new Vector3())
    const rotation = [0.12, 2.77, 0.09] as const

    const result = callPrivate<[
      readonly [number, number, number],
      readonly [number, number, number],
      number,
      Matrix4,
    ], Matrix4>(
      model,
      'composeModelTransform',
      [0, 0, 0],
      rotation,
      1,
      new Matrix4(),
    )
    const actual = new Quaternion().setFromRotationMatrix(result)
    // Babylon-MMD's Quaternion.FromEulerAngles uses Y-X-Z (yaw-pitch-roll).
    const expected = new Quaternion(
      0.05519693585589681,
      0.9795295494770963,
      -0.05057727902760362,
      0.18686117525981902,
    )

    expect(actual.angleTo(expected)).toBeLessThan(1e-7)
  })

  it('keeps an unmapped body in unscaled model space at the current root position', () => {
    const model = Object.create(
      MmdAmmoPhysicsModel.prototype,
    ) as MmdAmmoPhysicsModel
    const mesh = new SkinnedMesh()
    mesh.position.set(0, -10, 0)
    mesh.scale.setScalar(0.1)
    mesh.updateMatrixWorld(true)

    const bodyModelTransform = new Matrix4().makeTranslation(2, 3, 4)
    const writtenTransform = new Matrix4()
    const writeBodyTransform = vi.fn((_resource: unknown, transform: Matrix4) => {
      writtenTransform.copy(transform)
    })
    setPrivate(model, 'mmd', { mesh })
    setPrivate(model, 'bodies', [{
      bone: null,
      physicsMode: PmxObject.RigidBody.PhysicsMode.Physics,
    }])
    setPrivate(model, 'bodyModelTransforms', [bodyModelTransform])
    setPrivate(model, 'inversePhysicsRootMatrix', new Matrix4())
    setPrivate(model, 'inverseRootMatrix', new Matrix4())
    setPrivate(model, 'physicsRootMatrix', new Matrix4())
    setPrivate(model, 'rootQuaternion', new Quaternion())
    setPrivate(model, 'temporaryMatrixA', new Matrix4())
    setPrivate(model, 'temporaryMatrixB', new Matrix4())
    setPrivate(model, 'temporaryMatrixC', new Matrix4())
    setPrivate(model, 'temporaryPosition', new Vector3())
    setPrivate(model, 'temporaryPositionB', new Vector3())
    setPrivate(model, 'temporaryQuaternion', new Quaternion())
    setPrivate(model, 'temporaryScale', new Vector3())
    setPrivate(model, 'writeBodyTransform', writeBodyTransform)
    setPrivate(model, 'zeroBodyVelocity', vi.fn())
    setPrivate(model, 'setTemporalKinematic', vi.fn())

    callPrivate(model, 'initialize')

    expect(writeBodyTransform).toHaveBeenCalledOnce()
    expect(new Vector3().setFromMatrixPosition(writtenTransform).toArray())
      .toEqual([2, -7, 4])
    const physicsScale = new Vector3()
    const physicsRootMatrix = Reflect.get(
      model,
      'physicsRootMatrix',
    ) as Matrix4
    physicsRootMatrix.decompose(
      new Vector3(),
      new Quaternion(),
      physicsScale,
    )
    expect(physicsScale.toArray()).toEqual([1, 1, 1])
  })
})
