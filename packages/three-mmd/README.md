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

The baseline maps diffuse color/map and double-sided rendering directly,
keeps `metalness` at `0`, and approximates PMX shininess as GGX roughness.
PMX ambient, toon, sphere, outline, and texture-morph colors remain explicitly
unsupported by this pure Physical backend. PMX specular color is opt-in through
constructor options; when selecting options through the loader, provide a small
subclass:

```ts
import type { MMDMaterialDescriptor } from '@moeru/three-mmd/materials'

import { MMDPhysicalMaterial } from '@moeru/three-mmd/materials/physical'

class ProjectPhysicalMaterial extends MMDPhysicalMaterial {
  constructor(descriptor: MMDMaterialDescriptor) {
    super(descriptor, {
      alphaMode: 'evaluate',
      specularMode: 'physical-color',
    })
  }
}
```

## License

[MIT](../../LICENSE.md)
