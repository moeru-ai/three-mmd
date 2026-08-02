# @moeru/three-mmd-physics-ammo

Ammo.js physics plugin for `@moeru/three-mmd`.

## Install

```bash
pnpm add @moeru/three-mmd @moeru/three-mmd-physics-ammo
```

## Usage

Register `MMDAmmoPlugin` before loading the model:

```ts
import { MMDLoader } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'

const mmd = await new MMDLoader()
  .register(MMDAmmoPlugin)
  .loadAsync('/models/miku_v2.pmd')
```

The plugin initializes the shared Ammo runtime and installs a physics service
on the resulting `MMD`. For direct use of `MMDAmmoPhysics`, call `initAmmo()`
first.

```ts
import { initAmmo, MMDAmmoPhysics } from '@moeru/three-mmd-physics-ammo'

await initAmmo()
mmd.setPhysics(MMDAmmoPhysics)
```

## License

[MIT](../../LICENSE.md)
