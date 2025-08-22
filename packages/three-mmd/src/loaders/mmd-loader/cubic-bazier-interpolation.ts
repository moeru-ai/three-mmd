import { Interpolant, Quaternion } from 'three'

export class CubicBezierInterpolation extends Interpolant {
  interpolationParams: unknown

  constructor(parameterPositions: unknown[], sampleValues: unknown[], sampleSize: number, resultBuffer: unknown, params: unknown) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer)

    this.interpolationParams = params
  }

  _calculate(x1, x2, y1, y2, x) {
    /*
       * Cubic Bezier curves
       *   https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B.C3.A9zier_curves
       *
       * B(t) = ( 1 - t ) ^ 3 * P0
       *      + 3 * ( 1 - t ) ^ 2 * t * P1
       *      + 3 * ( 1 - t ) * t^2 * P2
       *      + t ^ 3 * P3
       *      ( 0 <= t <= 1 )
       *
       * MMD uses Cubic Bezier curves for bone and camera animation interpolation.
       *   http://d.hatena.ne.jp/edvakf/20111016/1318716097
       *
       *    x = ( 1 - t ) ^ 3 * x0
       *      + 3 * ( 1 - t ) ^ 2 * t * x1
       *      + 3 * ( 1 - t ) * t^2 * x2
       *      + t ^ 3 * x3
       *    y = ( 1 - t ) ^ 3 * y0
       *      + 3 * ( 1 - t ) ^ 2 * t * y1
       *      + 3 * ( 1 - t ) * t^2 * y2
       *      + t ^ 3 * y3
       *      ( x0 = 0, y0 = 0 )
       *      ( x3 = 1, y3 = 1 )
       *      ( 0 <= t, x1, x2, y1, y2 <= 1 )
       *
       * Here solves this equation with Bisection method,
       *   https://en.wikipedia.org/wiki/Bisection_method
       * gets t, and then calculate y.
       *
       * f(t) = 3 * ( 1 - t ) ^ 2 * t * x1
       *      + 3 * ( 1 - t ) * t^2 * x2
       *      + t ^ 3 - x = 0
       *
       * (Another option: Newton's method
       *    https://en.wikipedia.org/wiki/Newton%27s_method)
       */

    let c = 0.5
    let t = c
    let s = 1.0 - t
    const loop = 15
    const eps = 1e-5
    const math = Math

    let sst3, stt3, ttt

    for (let i = 0; i < loop; i++) {
      sst3 = 3.0 * s * s * t
      stt3 = 3.0 * s * t * t
      ttt = t * t * t

      const ft = (sst3 * x1) + (stt3 * x2) + (ttt) - x

      if (math.abs(ft) < eps)
        break

      c /= 2.0

      t += (ft < 0) ? c : -c
      s = 1.0 - t
    }

    return (sst3 * y1) + (stt3 * y2) + ttt
  }

  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer
    const values = this.sampleValues
    const stride = this.valueSize
    const params = this.interpolationParams

    const offset1 = i1 * stride
    const offset0 = offset1 - stride

    // No interpolation if next key frame is in one frame in 30fps.
    // This is from MMD animation spec.
    // '1.5' is for precision loss. times are Float32 in Three.js Animation system.
    const weight1 = ((t1 - t0) < 1 / 30 * 1.5) ? 0.0 : (t - t0) / (t1 - t0)

    if (stride === 4) { // Quaternion
      const x1 = params[i1 * 4 + 0]
      const x2 = params[i1 * 4 + 1]
      const y1 = params[i1 * 4 + 2]
      const y2 = params[i1 * 4 + 3]

      const ratio = this._calculate(x1, x2, y1, y2, weight1)

      Quaternion.slerpFlat(result, 0, values, offset0, values, offset1, ratio)
    }
    else if (stride === 3) { // Vector3
      for (let i = 0; i !== stride; ++i) {
        const x1 = params[i1 * 12 + i * 4 + 0]
        const x2 = params[i1 * 12 + i * 4 + 1]
        const y1 = params[i1 * 12 + i * 4 + 2]
        const y2 = params[i1 * 12 + i * 4 + 3]

        const ratio = this._calculate(x1, x2, y1, y2, weight1)

        result[i] = values[offset0 + i] * (1 - ratio) + values[offset1 + i] * ratio
      }
    }
    else { // Number
      const x1 = params[i1 * 4 + 0]
      const x2 = params[i1 * 4 + 1]
      const y1 = params[i1 * 4 + 2]
      const y2 = params[i1 * 4 + 3]

      const ratio = this._calculate(x1, x2, y1, y2, weight1)

      result[0] = values[offset0] * (1 - ratio) + values[offset1] * ratio
    }

    return result
  }
}
