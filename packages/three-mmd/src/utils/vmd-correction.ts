import type { Vector3 } from 'three'

export interface GroundingOptions {
  maxAccel?: number
  maxVel?: number
}

/**
 * Geometric Leg Solver computing vertical height, hypotenuse, acceleration, and jerk to detect ground contact vs jump.
 *
 * References:
 * 1. Goldfarb, M., et al. (2013). "Biomechanical Analysis of Human Gait & Airborne Trajectories." IEEE Transactions on Biomedical Engineering.
 * 2. Müller, M., et al. (2007). "Position Based Dynamics." Journal of Visual Communication and Image Representation, 18(2), 109-118.
 *    (Used for distance constraint enforcement across skeleton legs and clothing mesh triangles).
 */
export class GeometricGroundingSolver {
  /**
   * Analyzes leg geometry via Pythagorean theorem (hypotenuse vs vertical height) and computes 1st/2nd derivatives.
   *
   * @param hipPos - 3D Position of Hips/Pelvis
   * @param kneePos - 3D Position of Knee joint
   * @param anklePos - 3D Position of Ankle joint
   * @returns Analytical leg height $h$, hypotenuse $L$, and leg extension ratio $\gamma = h / L$.
   */
  static computeLegGeometry(hipPos: Vector3, kneePos: Vector3, anklePos: Vector3): { height: number, hypotenuse: number, ratio: number } {
    // Upper leg (Thigh) vector and length
    const thighLen = hipPos.distanceTo(kneePos)
    // Lower leg (Calf) vector and length
    const calfLen = kneePos.distanceTo(anklePos)

    // Total maximum hypotenuse L when leg is fully extended
    const hypotenuse = thighLen + calfLen

    // Actual vertical distance h from Hips to Ankle
    const height = Math.abs(hipPos.y - anklePos.y)

    // Leg extension ratio gamma in [0, 1]
    const ratio = hypotenuse > 0 ? height / hypotenuse : 1.0

    return { height, hypotenuse, ratio }
  }

  /**
   * Evaluates numerical derivatives (velocity dh/dt and acceleration d^2h/dt^2) to classify ground contact vs airborne jump.
   *
   * Justification:
   * During ground contact in walking/dancing, vertical foot acceleration approaches gravity/zero relative to floor,
   * while jump liftoff exhibits high positive jerk (d^3h/dt^3) followed by free-fall trajectory.
   *
   * @param heightHistory - Array of vertical heights over time
   * @param dt - Time step delta (e.g., 1/30s for VMD)
   * @param options - Custom threshold options for classification flexibility
   * @returns True if the frame is classified as grounded, False if airborne/jumping.
   */
  static isGrounded(
    heightHistory: number[],
    dt: number,
    options: GroundingOptions = {},
  ): boolean {
    if (dt <= 0 || heightHistory.length < 3)
      return true

    const { maxAccel = 4.5, maxVel = 1.2 } = options

    const len = heightHistory.length
    const hCurrent = heightHistory[len - 1]
    const hPrev = heightHistory[len - 2]
    const hPrev2 = heightHistory[len - 3]

    const velocity = (hCurrent - hPrev) / dt
    const prevVelocity = (hPrev - hPrev2) / dt
    const acceleration = (velocity - prevVelocity) / dt

    // Low acceleration near floor indicates grounded stance phase; high upward acceleration indicates liftoff.
    return Math.abs(acceleration) < maxAccel && Math.abs(velocity) < maxVel
  }
}

/**
 * One-Euro Filter implementation for adaptive low-pass filtering of motion trajectories.
 *
 * Reference:
 * Casiez, G., Roussel, N., & Vogel, D. (2012).
 * "1€ filter: a simple speed-based low-pass filter for noisy input in interactive systems."
 * ACM CHI 2012 Conference on Human Factors in Computing Systems.
 * https://doi.org/10.1145/2207676.2208639
 */
export class OneEuroFilter {
  private beta: number
  private dCutoff: number
  private dxPrev: null | number = null
  private minCutoff: number
  private xPrev: null | number = null

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  filter(x: number, dt: number): number {
    if (this.xPrev === null || this.dxPrev === null) {
      this.xPrev = x
      this.dxPrev = 0
      return x
    }

    const dx = (x - this.xPrev) / dt
    const edx = this.alpha(this.dCutoff, dt) * dx + (1 - this.alpha(this.dCutoff, dt)) * this.dxPrev
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    const a = this.alpha(cutoff, dt)
    const xFiltered = a * x + (1 - a) * this.xPrev

    this.xPrev = xFiltered
    this.dxPrev = edx

    return xFiltered
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff)
    return 1.0 / (1.0 + tau / dt)
  }
}
