/* eslint-disable new-cap */
import Ammo from 'ammojs-typed'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

/**
 * This manager's responsibilities are
 *
 * 1. manage Ammo.js and Three.js object resources and
 *    improve the performance and the memory consumption by
 *    reusing objects.
 *
 * 2. provide simple Ammo object operations.
 */
export class ResourceManager {
  quaternions: Ammo.btQuaternion[]
  threeEulers: Euler[]
  threeMatrix4s: Matrix4[]
  threeQuaternions: Quaternion[]
  threeVector3s: Vector3[]
  transforms: Ammo.btTransform[]
  vector3s: Ammo.btVector3[]

  constructor() {
    // for Three.js
    this.threeVector3s = []
    this.threeMatrix4s = []
    this.threeQuaternions = []
    this.threeEulers = []

    // for Ammo.js
    this.transforms = []
    this.quaternions = []
    this.vector3s = []
  }

  addVector3(v1: Ammo.btVector3, v2: Ammo.btVector3) {
    const v = this.allocVector3()
    v.setValue(v1.x() + v2.x(), v1.y() + v2.y(), v1.z() + v2.z())
    return v
  }

  allocQuaternion() {
    return (this.quaternions.length > 0)
      ? this.quaternions.pop() as Ammo.btQuaternion
      : new Ammo.btQuaternion(0, 0, 0, 0)
  }

  allocThreeEuler() {
    return (this.threeEulers.length > 0)
      ? this.threeEulers.pop() as Euler
      : new Euler()
  }

  allocThreeMatrix4() {
    return (this.threeMatrix4s.length > 0)
      ? this.threeMatrix4s.pop() as Matrix4
      : new Matrix4()
  }

  allocThreeQuaternion() {
    return (this.threeQuaternions.length > 0)
      ? this.threeQuaternions.pop() as Quaternion
      : new Quaternion()
  }

  allocThreeVector3() {
    return (this.threeVector3s.length > 0)
      ? this.threeVector3s.pop() as Vector3
      : new Vector3()
  }

  allocTransform() {
    return (this.transforms.length > 0)
      ? this.transforms.pop() as Ammo.btTransform
      : new Ammo.btTransform()
  }

  allocVector3() {
    return (this.vector3s.length > 0)
      ? this.vector3s.pop() as Ammo.btVector3
      : new Ammo.btVector3()
  }

  // TODO: strict type
  columnOfMatrix3(m: Record<number, number>, i: number) {
    const v = this.allocVector3()
    v.setValue(m[i + 0], m[i + 3], m[i + 6])
    return v
  }

  copyOrigin(t1: Ammo.btTransform, t2: Ammo.btTransform) {
    const o = t2.getOrigin()
    this.setOrigin(t1, o)
  }

  dotVectors3(v1: Ammo.btVector3, v2: Ammo.btVector3) {
    return v1.x() * v2.x() + v1.y() * v2.y() + v1.z() * v2.z()
  }

  freeQuaternion(q: Ammo.btQuaternion) {
    this.quaternions.push(q)
  }

  freeThreeEuler(e: Euler) {
    this.threeEulers.push(e)
  }

  freeThreeMatrix4(m: Matrix4) {
    this.threeMatrix4s.push(m)
  }

  freeThreeQuaternion(q: Quaternion) {
    this.threeQuaternions.push(q)
  }

  freeThreeVector3(v: Vector3) {
    this.threeVector3s.push(v)
  }

  freeTransform(t: Ammo.btTransform) {
    this.transforms.push(t)
  }

  freeVector3(v: Ammo.btVector3) {
    this.vector3s.push(v)
  }

  getBasis(t: Ammo.btTransform) {
    const q = this.allocQuaternion()
    t.getBasis().getRotation(q)
    return q
  }

  getBasisAsMatrix3(t: Ammo.btTransform) {
    const q = this.getBasis(t)
    const m = this.quaternionToMatrix3(q)
    this.freeQuaternion(q)
    return m
  }

  getOrigin(t: Ammo.btTransform) {
    return t.getOrigin()
  }

  inverseTransform(t: Ammo.btTransform) {
    const t2 = this.allocTransform()

    const m1 = this.getBasisAsMatrix3(t)
    const o = this.getOrigin(t)

    const m2 = this.transposeMatrix3(m1)
    const v1 = this.negativeVector3(o)
    const v2 = this.multiplyMatrix3ByVector3(m2, v1)

    this.setOrigin(t2, v2)
    this.setBasisFromMatrix3(t2, m2)

    this.freeVector3(v1)
    this.freeVector3(v2)

    return t2
  }

  // TODO: strict type
  matrix3ToQuaternion(m: Record<number, number>) {
    const t = m[0] + m[4] + m[8]
    let s, w, x, y, z

    if (t > 0) {
      s = Math.sqrt(t + 1.0) * 2
      w = 0.25 * s
      x = (m[7] - m[5]) / s
      y = (m[2] - m[6]) / s
      z = (m[3] - m[1]) / s
    }
    else if ((m[0] > m[4]) && (m[0] > m[8])) {
      s = Math.sqrt(1.0 + m[0] - m[4] - m[8]) * 2
      w = (m[7] - m[5]) / s
      x = 0.25 * s
      y = (m[1] + m[3]) / s
      z = (m[2] + m[6]) / s
    }
    else if (m[4] > m[8]) {
      s = Math.sqrt(1.0 + m[4] - m[0] - m[8]) * 2
      w = (m[2] - m[6]) / s
      x = (m[1] + m[3]) / s
      y = 0.25 * s
      z = (m[5] + m[7]) / s
    }
    else {
      s = Math.sqrt(1.0 + m[8] - m[0] - m[4]) * 2
      w = (m[3] - m[1]) / s
      x = (m[2] + m[6]) / s
      y = (m[5] + m[7]) / s
      z = 0.25 * s
    }

    const q = this.allocQuaternion()
    q.setX(x)
    q.setY(y)
    q.setZ(z)
    q.setW(w)
    return q
  }

  // TODO: strict type
  multiplyMatrices3(m1: Record<number, number>, m2: Record<number, number>) {
    const m3 = []

    const v10 = this.rowOfMatrix3(m1, 0)
    const v11 = this.rowOfMatrix3(m1, 1)
    const v12 = this.rowOfMatrix3(m1, 2)

    const v20 = this.columnOfMatrix3(m2, 0)
    const v21 = this.columnOfMatrix3(m2, 1)
    const v22 = this.columnOfMatrix3(m2, 2)

    m3[0] = this.dotVectors3(v10, v20)
    m3[1] = this.dotVectors3(v10, v21)
    m3[2] = this.dotVectors3(v10, v22)
    m3[3] = this.dotVectors3(v11, v20)
    m3[4] = this.dotVectors3(v11, v21)
    m3[5] = this.dotVectors3(v11, v22)
    m3[6] = this.dotVectors3(v12, v20)
    m3[7] = this.dotVectors3(v12, v21)
    m3[8] = this.dotVectors3(v12, v22)

    this.freeVector3(v10)
    this.freeVector3(v11)
    this.freeVector3(v12)
    this.freeVector3(v20)
    this.freeVector3(v21)
    this.freeVector3(v22)

    return m3
  }

  // TODO: strict type
  multiplyMatrix3ByVector3(m: Record<number, number>, v: Ammo.btVector3) {
    const v4 = this.allocVector3()

    const v0 = this.rowOfMatrix3(m, 0)
    const v1 = this.rowOfMatrix3(m, 1)
    const v2 = this.rowOfMatrix3(m, 2)
    const x = this.dotVectors3(v0, v)
    const y = this.dotVectors3(v1, v)
    const z = this.dotVectors3(v2, v)

    v4.setValue(x, y, z)

    this.freeVector3(v0)
    this.freeVector3(v1)
    this.freeVector3(v2)

    return v4
  }

  multiplyTransforms(t1: Ammo.btTransform, t2: Ammo.btTransform) {
    const t = this.allocTransform()
    this.setIdentity(t)

    const m1 = this.getBasisAsMatrix3(t1)
    const m2 = this.getBasisAsMatrix3(t2)

    const o1 = this.getOrigin(t1)
    const o2 = this.getOrigin(t2)

    const v1 = this.multiplyMatrix3ByVector3(m1, o2)
    const v2 = this.addVector3(v1, o1)
    this.setOrigin(t, v2)

    const m3 = this.multiplyMatrices3(m1, m2)
    this.setBasisFromMatrix3(t, m3)

    this.freeVector3(v1)
    this.freeVector3(v2)

    return t
  }

  negativeVector3(v: Ammo.btVector3) {
    const v2 = this.allocVector3()
    v2.setValue(-v.x(), -v.y(), -v.z())
    return v2
  }

  quaternionToMatrix3(q: Ammo.btQuaternion) {
    const m = []

    const x = q.x()
    const y = q.y()
    const z = q.z()
    const w = q.w()

    const xx = x * x
    const yy = y * y
    const zz = z * z

    const xy = x * y
    const yz = y * z
    const zx = z * x

    const xw = x * w
    const yw = y * w
    const zw = z * w

    m[0] = 1 - 2 * (yy + zz)
    m[1] = 2 * (xy - zw)
    m[2] = 2 * (zx + yw)
    m[3] = 2 * (xy + zw)
    m[4] = 1 - 2 * (zz + xx)
    m[5] = 2 * (yz - xw)
    m[6] = 2 * (zx - yw)
    m[7] = 2 * (yz + xw)
    m[8] = 1 - 2 * (xx + yy)

    return m
  }

  // TODO: strict type
  rowOfMatrix3(m: Record<number, number>, i: number) {
    const v = this.allocVector3()
    v.setValue(m[i * 3 + 0], m[i * 3 + 1], m[i * 3 + 2])
    return v
  }

  setBasis(t: Ammo.btTransform, q: Ammo.btQuaternion) {
    t.setRotation(q)
  }

  setBasisFromArray3(t: Ammo.btTransform, a: number[]) {
    const thQ = this.allocThreeQuaternion()
    const thE = this.allocThreeEuler()
    thE.set(a[0], a[1], a[2])
    this.setBasisFromThreeQuaternion(t, thQ.setFromEuler(thE))

    this.freeThreeEuler(thE)
    this.freeThreeQuaternion(thQ)
  }

  // TODO: strict type
  setBasisFromMatrix3(t: Ammo.btTransform, m: Record<number, number>) {
    const q = this.matrix3ToQuaternion(m)
    this.setBasis(t, q)
    this.freeQuaternion(q)
  }

  setBasisFromThreeQuaternion(t: Ammo.btTransform, a: Quaternion) {
    const q = this.allocQuaternion()

    q.setX(a.x)
    q.setY(a.y)
    q.setZ(a.z)
    q.setW(a.w)
    this.setBasis(t, q)

    this.freeQuaternion(q)
  }

  setIdentity(t: Ammo.btTransform) {
    t.setIdentity()
  }

  setOrigin(t: Ammo.btTransform, v: Ammo.btVector3) {
    t.getOrigin().setValue(v.x(), v.y(), v.z())
  }

  setOriginFromArray3(t: Ammo.btTransform, a: number[]) {
    t.getOrigin().setValue(a[0], a[1], a[2])
  }

  setOriginFromThreeVector3(t: Ammo.btTransform, v: Vector3) {
    t.getOrigin().setValue(v.x, v.y, v.z)
  }

  // TODO: strict type
  transposeMatrix3(m: Record<number, number>) {
    const m2 = []
    m2[0] = m[0]
    m2[1] = m[3]
    m2[2] = m[6]
    m2[3] = m[1]
    m2[4] = m[4]
    m2[5] = m[7]
    m2[6] = m[2]
    m2[7] = m[5]
    m2[8] = m[8]
    return m2
  }
}
