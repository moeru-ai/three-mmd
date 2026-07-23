import type { MMD } from '../utils/mmd'

export type PhysicsFactory = (mmd: MMD) => PhysicsService

export interface PhysicsService {
  createHelper: <T>() => T
  dispose?: () => void
  reset?: () => void
  setScalar?: (scale: number) => void
  update: (delta: number) => void
}
