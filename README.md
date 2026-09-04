# `@moeru/three-mmd`

Use MMD on Three.js

## Packages

- [`@moeru/three-mmd`](packages/three-mmd/README.md) — core runtime and opt-in WebGL toon/physical materials
- [`@moeru/three-mmd-physics-ammo`](packages/three-mmd-physics-ammo/README.md) — Ammo.js physics
- [`@moeru/three-mmd-physics-springbone`](packages/three-mmd-physics-springbone/README.md) — spring bone physics

## Install

```bash
pnpm add three @moeru/three-mmd
pnpm add -D @types/three
```

## Basic usage

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

## Physics

Physics is provided by separate packages. Register one plugin before loading
the model:

```ts
import { MMDLoader } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'

const mmd = await new MMDLoader()
  .register(MMDAmmoPlugin)
  .loadAsync('/models/miku_v2.pmd')
```

The default material backend is the WebGL `MMDToonMaterial`.

## See also

- [noname0310/babylon-mmd](https://github.com/noname0310/babylon-mmd)
- [pixiv/three-vrm](https://github.com/pixiv/three-vrm/)

## License

[MIT](LICENSE.md)

This project is based on the code from [babylon-mmd](https://github.com/noname0310/babylon-mmd),
 [three.js](https://github.com/mrdoob/three.js/tree/r171) and [three-ts-types](https://github.com/three-types/three-ts-types/tree/r171) r171.

## Sponsors

![sponsors](https://github.com/kwaa/sponsors/blob/main/public/sponsors.svg?raw=true)
