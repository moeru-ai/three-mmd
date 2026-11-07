# @moeru/three-mmd

MMD loading, animation, materials, and runtime lifecycle for Three.js.

## Install

```bash
pnpm add three @moeru/three-mmd
pnpm add -D @types/three
```

## Load a model and play a VMD animation

```ts
import { buildAnimation, MMDLoader, VMDLoader } from '@moeru/three-mmd'
import { AnimationMixer, Timer } from 'three'

const mmd = await new MMDLoader().loadAsync('/models/miku_v2.pmd')
const vmd = await new VMDLoader().loadAsync('/motions/wavefile_v2.vmd')
const mixer = new AnimationMixer(mmd.mesh)
const timer = new Timer()

mixer.clipAction(buildAnimation(vmd, mmd.mesh)).play()

// Call this once per render frame.
const update = () =>
  mmd.updateWithMixer(timer.getDelta(), mixer)
```

`updateWithMixer()` restores the previous animation pose, advances the mixer,
then applies MMD IK, grants, and the optional physics service. Use `update()`
directly when the mixer is managed elsewhere; do not call both methods for the
same frame.

For a static VPD pose, load it with `VPDLoader` and apply it with `applyVPD`:

```ts
import { applyVPD, VPDLoader } from '@moeru/three-mmd'

const vpd = await new VPDLoader().loadAsync('/poses/pose.vpd')
applyVPD(mmd, vpd)
```

## Coordinate multiple MMD assets

`MMDAnimationManager` owns one standard Three.js mixer per MMD model and can
also coordinate one camera animation and one audio source:

```ts
import { MMDAnimationManager } from '@moeru/three-mmd'

const manager = new MMDAnimationManager()
manager.add(firstMMD, { animation: firstAnimation })
manager.add(secondMMD, { animation: secondAnimation })
manager.add(camera, { animation: cameraAnimation })
manager.add(audio, { delayTime: 160 / 30 })

// Keep this as the only update call for the registered assets.
const update = () => manager.update(timer.getDelta())
```

Animations passed to `add` are created and played by the manager. The mixer and
actions remain internal, so callers only need to register objects and call
`update()`.

## Physics plugins

Physics is provided by separate packages. Register one plugin before loading
the model:

```ts
import { MMDLoader } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'

const mmd = await new MMDLoader()
  .register(MMDAmmoPlugin)
  .loadAsync('/models/miku_v2.pmd')
```

- [@moeru/three-mmd-physics-ammo](https://www.npmjs.com/package/@moeru/three-mmd-physics-ammo)
- [@moeru/three-mmd-physics-springbone](https://www.npmjs.com/package/@moeru/three-mmd-physics-springbone)

The default material backend is the WebGL `MMDToonMaterial`.

## Opt-in Physical material

`MMDPhysicalMaterial` keeps Three's native physical lights and environment
lighting. Register it before loading a model and provide a PMREM-backed
`scene.environment` for stable image-based lighting:

```ts
import { MMDLoader, MMDMaterialPlugin } from '@moeru/three-mmd'
import { MMDPhysicalMaterial } from '@moeru/three-mmd/materials/physical'

const loader = new MMDLoader()
loader.register(parser => new MMDMaterialPlugin(parser, {
  materialType: MMDPhysicalMaterial,
}))

const mmd = await loader.loadAsync('/models/miku.pmx')
```

Diffuse color/map and sidedness map directly, `metalness` stays `0`, and PMX
shininess is approximated as GGX roughness. PMX ambient, specular, toon and
sphere textures are not supported by this backend.

## WebGPU

`MMDToonNodeMaterial` is the TSL counterpart of `MMDToonMaterial` for
`WebGPURenderer` (`three/webgpu`). It takes the same parameters, including
toon and sphere textures and PMX SDEF skinning:

```ts
import { MMDLoader, MMDMaterialPlugin } from '@moeru/three-mmd'
import { MMDToonNodeMaterial } from '@moeru/three-mmd/materials/toon-node'
import { WebGPURenderer } from 'three/webgpu'

const renderer = new WebGPURenderer()
await renderer.init()

const loader = new MMDLoader()
loader.register(parser => new MMDMaterialPlugin(parser, {
  materialType: MMDToonNodeMaterial,
}))
```

The node material and the classic materials can't be mixed on one renderer:
use `MMDToonMaterial` with `WebGLRenderer`. `WebGPURenderer({ forceWebGL: true })`
runs the same node material on its WebGL 2 backend.

## License

[MIT](../../LICENSE.md)
