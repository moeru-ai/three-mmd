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

  it('should correctly classify grounded vs airborne state using GeometricGroundingSolver', () => {
    const dt = 1 / 30

    // Constant grounded height sequence (low acceleration)
    const groundedHeights = [1.0, 1.001, 1.002]
    expect(GeometricGroundingSolver.isGrounded(groundedHeights, dt)).toBe(true)

    // High velocity/acceleration liftoff sequence (jumping)
    const airborneHeights = [1.0, 2.5, 5.0]
    expect(GeometricGroundingSolver.isGrounded(airborneHeights, dt)).toBe(false)
  })
})
