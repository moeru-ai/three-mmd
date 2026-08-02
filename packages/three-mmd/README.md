# @moeru/three-mmd

MMD loading, animation, materials, and runtime lifecycle for Three.js.

## Install

```bash
pnpm add three @moeru/three-mmd
pnpm add -D @types/three
```

## Load a model and play a VMD animation

```ts
import {
  buildAnimation,
  MMDLoader,
  VMDLoader,
} from '@moeru/three-mmd'
import { AnimationMixer, Clock } from 'three'

const mmd = await new MMDLoader().loadAsync('/models/miku_v2.pmd')
const vmd = await new VMDLoader().loadAsync('/motions/wavefile_v2.vmd')
const mixer = new AnimationMixer(mmd.mesh)
const clock = new Clock()

mixer.clipAction(buildAnimation(vmd, mmd.mesh)).play()

// Call this once per render frame.
const update = () => {
  mmd.updateWithMixer(clock.getDelta(), mixer)
}
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

## License

[MIT](../../LICENSE.md)
