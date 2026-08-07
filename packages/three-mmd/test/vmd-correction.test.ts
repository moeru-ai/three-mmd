import { describe, expect, it } from 'vitest'

import { GeometricGroundingSolver, OneEuroFilter } from '../src/utils/vmd-correction'

describe('vMD Motion Correction', () => {
  it('should compute OneEuroFilter smoothing correctly', () => {
    const filter = new OneEuroFilter(1.0, 0.007, 1.0)
    const dt = 1 / 30

    const val1 = filter.filter(10.0, dt)
    expect(val1).toBe(10.0)

    const val2 = filter.filter(12.0, dt)
    expect(val2).toBeGreaterThan(10.0)
    expect(val2).toBeLessThan(12.0)
  })

  it('should correctly classify grounded vs airborne state using GeometricGroundingSolver with default thresholds', () => {
    const dt = 1 / 30

    // Constant grounded height sequence (low acceleration)
    const groundedHeights = [1.0, 1.001, 1.002]
    expect(GeometricGroundingSolver.isGrounded(groundedHeights, dt)).toBe(true)

    // High velocity/acceleration liftoff sequence (jumping)
    const airborneHeights = [1.0, 2.5, 5.0]
    expect(GeometricGroundingSolver.isGrounded(airborneHeights, dt)).toBe(false)
  })

  it('should support custom thresholds/options in GeometricGroundingSolver', () => {
    const dt = 1 / 30

    // Sequence that would normally be classified as airborne under default options (acceleration = 1350, velocity = 45)
    // By passing extremely high custom thresholds, it can be classified as grounded
    const sequence = [1.0, 2.5, 5.0]
    expect(
      GeometricGroundingSolver.isGrounded(sequence, dt, { maxAccel: 2000, maxVel: 100 }),
    ).toBe(true)

    // And vice-versa, low thresholds make even small movements airborne
    const smallMovements = [1.0, 1.01, 1.02] // vel = 0.3, acc = 0
    expect(
      GeometricGroundingSolver.isGrounded(smallMovements, dt, { maxAccel: 5.0, maxVel: 0.1 }),
    ).toBe(false)
  })

  it('should handle dt <= 0 safely and return true', () => {
    const sequence = [1.0, 2.5, 5.0]
    expect(GeometricGroundingSolver.isGrounded(sequence, 0)).toBe(true)
    expect(GeometricGroundingSolver.isGrounded(sequence, -1)).toBe(true)
  })
})
