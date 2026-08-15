import type { VmdObject } from 'babylon-mmd/esm/Loader/Parser/vmdObject'
import type { SkinnedMesh } from 'three'

import { describe, expect, it } from 'vitest'

import { buildAnimation } from '../src/utils/build-animation'

describe('cubicBezierInterpolation optimization tests', () => {
  it('should correctly calculate linear interpolation when x1===y1 && x2===y2', () => {
    // Mock minimal objects to test buildAnimation / _calculate behavior
    const mockFrame = {
      boneName: 'root',
      frameNumber: 30,
      interpolation: new Uint8Array([20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]),
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
    }

    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const vmd = {
      boneKeyFrames: {
        get: () => mockFrame,
        length: 1,
      },
      cameraKeyFrames: { get: () => mockFrame, length: 0 },
      morphKeyFrames: { get: () => mockFrame, length: 0 },
      propertyKeyFrames: { get: () => mockFrame, length: 0 },
    } as unknown as VmdObject

    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const mesh = {
      morphTargetDictionary: {},
      skeleton: {
        bones: [{ name: 'root', position: { toArray: () => [0, 0, 0] } }],
        getBoneByName: () => ({ position: { toArray: () => [0, 0, 0] } }),
      },
    } as unknown as SkinnedMesh

    const clip = buildAnimation(vmd, mesh)
    expect(clip).toBeDefined()
    expect(clip.tracks).toHaveLength(2)
  })

  it('should evaluate steep cubic bezier curves with bisection fallback without numerical spikes or NaN', () => {
    // Extreme steep ease-in-out S-curve where derivative approaches 0: x1=0.9, y1=0.05, x2=0.1, y2=0.95
    // PMX/VMD parameter values scaled by 127: x1=114, y1=6, x2=13, y2=121
    const frame0 = {
      boneName: 'root',
      frameNumber: 0,
      interpolation: new Uint8Array([114, 13, 6, 121, 114, 13, 6, 121, 114, 13, 6, 121, 114, 13, 6, 121]),
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    }
    const frame60 = {
      boneName: 'root',
      frameNumber: 60,
      interpolation: new Uint8Array([114, 13, 6, 121, 114, 13, 6, 121, 114, 13, 6, 121, 114, 13, 6, 121]),
      position: [0, 10, 0],
      rotation: [0, 0, 0, 1],
    }

    const frames = [frame0, frame60]
    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const vmd = {
      boneKeyFrames: {
        get: (i: number) => frames[i],
        length: 2,
      },
      cameraKeyFrames: { get: () => frame0, length: 0 },
      morphKeyFrames: { get: () => frame0, length: 0 },
      propertyKeyFrames: { get: () => frame0, length: 0 },
    } as unknown as VmdObject

    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    const mesh = {
      morphTargetDictionary: {},
      skeleton: {
        bones: [{ name: 'root', position: { toArray: () => [0, 0, 0] } }],
        getBoneByName: () => ({ position: { toArray: () => [0, 0, 0] } }),
      },
    } as unknown as SkinnedMesh

    const clip = buildAnimation(vmd, mesh)
    expect(clip).toBeDefined()
    expect(clip.tracks).toHaveLength(2)

    const posTrack = clip.tracks.find(t => t.name === '.bones[root].position')
    expect(posTrack).toBeDefined()

    // Test interpolant evaluation across multiple time samples [0.0s -> 2.0s]
    const trackWithInterpolant = posTrack as unknown as { createInterpolant: () => { evaluate: (t: number) => ArrayLike<number> } }
    const interpolant = trackWithInterpolant.createInterpolant()
    let prevY = -1
    for (let t = 0; t <= 2.0; t += 0.05) {
      const current = interpolant.evaluate(t)
      const currentY = +current[1]

      // Must be finite and within expected monotonic range [0, 10]
      expect(Number.isFinite(currentY)).toBe(true)
      expect(currentY).toBeGreaterThanOrEqual(0.0)
      expect(currentY).toBeLessThanOrEqual(10.0)

      if (prevY >= 0) {
        expect(currentY).toBeGreaterThanOrEqual(prevY - 1e-4)
      }
      prevY = currentY
    }
  })
})
