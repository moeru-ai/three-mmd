import type { MMD } from '../utils/mmd'

export type PhysicsFactory<T> = (mmd: MMD) => PhysicsService<T>

export interface PhysicsService<T = unknown> {
  createHelper?: () => T
  dispose?: () => void
  setScalar?: (scale: number) => void
  update: (delta: number) => void
}
