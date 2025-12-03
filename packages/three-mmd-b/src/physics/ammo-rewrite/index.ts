/* eslint-disable new-cap */
import type { BoxGeometry, BufferGeometry, IcosahedronGeometry, InstancedMesh, Mesh, Scene, SphereGeometry, TypedArray, Vector3 } from 'three'

import Ammo from 'ammojs-typed'

import { createWorld } from './_create-world'

const compose = (position: Ammo.btVector3, quaternion: Ammo.btQuaternion, array: TypedArray, index: number) => {
  const w = quaternion.w()
  const x = quaternion.x()
  const y = quaternion.y()
  const z = quaternion.z()
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2

  array[index + 0] = (1 - (yy + zz))
  array[index + 1] = (xy + wz)
  array[index + 2] = (xz - wy)
  array[index + 3] = 0

  array[index + 4] = (xy - wz)
  array[index + 5] = (1 - (xx + zz))
  array[index + 6] = (yz + wx)
  array[index + 7] = 0

  array[index + 8] = (xz + wy)
  array[index + 9] = (yz - wx)
  array[index + 10] = (1 - (xx + yy))
  array[index + 11] = 0

  array[index + 12] = position.x()
  array[index + 13] = position.y()
  array[index + 14] = position.z()
  array[index + 15] = 1
}

export const AmmoPhysics = () => {
  const world = createWorld()
  world.setGravity(new Ammo.btVector3(0, -9.8, 0))

  const worldTransform = new Ammo.btTransform()

  const getShape = (geometry: BufferGeometry) => {
    // TODO change type to is*
    if (geometry.type === 'BoxGeometry') {
      const { parameters } = geometry as BoxGeometry
      const sx = parameters.width != null ? parameters.width / 2 : 0.5
      const sy = parameters.height != null ? parameters.height / 2 : 0.5
      const sz = parameters.depth != null ? parameters.depth / 2 : 0.5

      const shape = new Ammo.btBoxShape(new Ammo.btVector3(sx, sy, sz))
      shape.setMargin(0.05)

      return shape
    }
    else if (geometry.type === 'SphereGeometry' || geometry.type === 'IcosahedronGeometry') {
      const { parameters } = geometry as IcosahedronGeometry | SphereGeometry
      const radius = parameters.radius != null ? parameters.radius : 1

      const shape = new Ammo.btSphereShape(radius)
      shape.setMargin(0.05)

      return shape
    }

    console.error('AmmoPhysics: Unsupported geometry type:', geometry.type)

    return null
  }

  const meshes: Mesh[] = []
  const meshMap = new WeakMap<WeakKey, Ammo.btRigidBody | Ammo.btRigidBody[]>()

  const handleMesh = (mesh: Mesh, shape: Ammo.btBoxShape | Ammo.btSphereShape, mass: number, restitution: number) => {
    const position = mesh.position
    const quaternion = mesh.quaternion

    const transform = new Ammo.btTransform()
    transform.setIdentity()
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z))
    transform.setRotation(new Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w))

    const motionState = new Ammo.btDefaultMotionState(transform)

    const localInertia = new Ammo.btVector3(0, 0, 0)
    shape.calculateLocalInertia(mass, localInertia)

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia)
    rbInfo.set_m_restitution(restitution)

    const body = new Ammo.btRigidBody(rbInfo)
    // body.setFriction( 4 );
    world.addRigidBody(body)

    if (mass > 0) {
      meshes.push(mesh)
      meshMap.set(mesh, body)
    }
  }

  const handleInstancedMesh = (mesh: InstancedMesh, shape: Ammo.btBoxShape | Ammo.btSphereShape, mass: number, restitution: number) => {
    const array = mesh.instanceMatrix.array

    const bodies = []

    for (let i = 0; i < mesh.count; i++) {
      const index = i * 16

      const transform = new Ammo.btTransform()
      transform.setFromOpenGLMatrix(Array.from(array).slice(index, index + 16))

      const motionState = new Ammo.btDefaultMotionState(transform)

      const localInertia = new Ammo.btVector3(0, 0, 0)
      shape.calculateLocalInertia(mass, localInertia)

      const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia)
      rbInfo.set_m_restitution(restitution)

      const body = new Ammo.btRigidBody(rbInfo)
      world.addRigidBody(body)

      bodies.push(body)
    }

    if (mass > 0) {
      meshes.push(mesh)

      meshMap.set(mesh, bodies)
    }
  }

  const addMesh = (mesh: Mesh, mass = 0, restitution = 0) => {
    const shape = getShape(mesh.geometry)

    if (shape !== null) {
      if ('isInstancedMesh' in mesh && mesh.isInstancedMesh === true) {
        handleInstancedMesh(mesh as InstancedMesh, shape, mass, restitution)
      }
      else if (mesh.isMesh) {
        handleMesh(mesh, shape, mass, restitution)
      }
    }
  }

  const addScene = (scene: Scene) => {
    scene.traverse((child) => {
      if (('isMesh' in child && child.isMesh) === false)
        return

      const { physics } = child.userData as {
        physics?: {
          mass?: number
          restitution?: number
        }
      }

      if (physics) {
        addMesh(child as Mesh, physics.mass, physics.restitution)
      }
    })
  }

  const setMeshPosition = (mesh: Mesh, position: Vector3, index = 0) => {
    if ('isInstancedMesh' in mesh && mesh.isInstancedMesh === true) {
      const bodies = meshMap.get(mesh)
      const body = (bodies as Ammo.btRigidBody[])[index]

      body.setAngularVelocity(new Ammo.btVector3(0, 0, 0))
      body.setLinearVelocity(new Ammo.btVector3(0, 0, 0))

      worldTransform.setIdentity()
      worldTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z))
      body.setWorldTransform(worldTransform)
    }
    else if (mesh.isMesh) {
      const body = meshMap.get(mesh) as Ammo.btRigidBody

      body.setAngularVelocity(new Ammo.btVector3(0, 0, 0))
      body.setLinearVelocity(new Ammo.btVector3(0, 0, 0))

      worldTransform.setIdentity()
      worldTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z))
      body.setWorldTransform(worldTransform)
    }
  }

  const update = (delta: number) => {
    world.stepSimulation(delta, 10)

    for (let i = 0, l = meshes.length; i < l; i++) {
      const mesh = meshes[i]

      if ('isInstancedMesh' in mesh && mesh.isInstancedMesh === true) {
        const array = (mesh as InstancedMesh).instanceMatrix.array
        const bodies = meshMap.get(mesh) as Ammo.btRigidBody[]

        for (let j = 0; j < bodies.length; j++) {
          const body = bodies[j]

          const motionState = body.getMotionState()
          motionState.getWorldTransform(worldTransform)

          const position = worldTransform.getOrigin()
          const quaternion = worldTransform.getRotation()

          compose(position, quaternion, array, j * 16)
        }

        (mesh as InstancedMesh).instanceMatrix.needsUpdate = true
        ; (mesh as InstancedMesh).computeBoundingSphere()
      }
      else if (mesh.isMesh) {
        const body = meshMap.get(mesh) as Ammo.btRigidBody

        const motionState = body.getMotionState()
        motionState.getWorldTransform(worldTransform)

        const position = worldTransform.getOrigin()
        const quaternion = worldTransform.getRotation()
        mesh.position.set(position.x(), position.y(), position.z())
        mesh.quaternion.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w())
      }
    }
  }

  return {
    addMesh,
    addScene,
    setMeshPosition,
    update,
  }
}
