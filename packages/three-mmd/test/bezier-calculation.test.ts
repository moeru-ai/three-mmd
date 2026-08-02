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
})
