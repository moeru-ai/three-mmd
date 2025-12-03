/* eslint-disable new-cap */
import Ammo from 'ammojs-typed'

export const createWorld = () => {
  const config = new Ammo.btDefaultCollisionConfiguration()
  const dispatcher = new Ammo.btCollisionDispatcher(config)
  const cache = new Ammo.btDbvtBroadphase()
  const solver = new Ammo.btSequentialImpulseConstraintSolver()

  return new Ammo.btDiscreteDynamicsWorld(dispatcher, cache, solver, config)
}
