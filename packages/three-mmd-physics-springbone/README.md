# @moeru/three-mmd-physics-springbone

Spring bone physics plugin for `@moeru/three-mmd`, powered by
`@pixiv/three-vrm-springbone`.

## Install

```bash
pnpm add @moeru/three-mmd @moeru/three-mmd-physics-springbone
```

## Usage

Register `MMDSpringBonePlugin` before loading the model:

```ts
import { MMDLoader } from '@moeru/three-mmd'
import { MMDSpringBonePlugin } from '@moeru/three-mmd-physics-springbone'

const mmd = await new MMDLoader()
  .register(MMDSpringBonePlugin)
  .loadAsync('/models/miku_v2.pmd')
```

The backend builds spring joints for recognized hair and skirt bone names and
uses PMX rigid-body shapes as colliders where available. It is an optional
alternative to the Ammo.js backend, not a core dependency.

## License

[MIT](../../LICENSE.md)
