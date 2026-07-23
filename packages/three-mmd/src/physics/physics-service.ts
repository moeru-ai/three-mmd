import type { MMD } from '../utils/mmd'

export type PhysicsFactory = (mmd: MMD) => PhysicsService

export interface PhysicsService {
  /** Whether this service drives PMX bones and activates physics-aware IK. */
  affectsIK?: boolean
  createHelper: <T>() => T
  dispose?: () => void
  reset?: () => void
  setScalar?: (scale: number) => void
  update: (delta: number) => void
}
