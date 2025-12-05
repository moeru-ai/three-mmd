# `@moeru/three-mmd`

Use MMD on Three.js

## Usage

```bash
npm i three @moeru/three-mmd
npm i -D @types/three
```

> There may be significant changes in future versions, so this is unstable.

```ts
import { MMDLoader } from '@moeru/three-mmd'
import { Scene } from 'three'

const scene = new Scene()
const loader = new MMDLoader()

loader.load(
  // URL of the model you want to load
  '/models/miku_v2.pmd',
  // called when the resource is loaded
  mmd => scene.add(mmd.mesh),
  // called while loading is progressing
  progress => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
  // called when loading has errors
  error => console.error(error),
)
```

## Roadmap

- PBR-based Material
- Rapier physics
- WebGPURenderer compatibility

## See also

- [noname0310/babylon-mmd](https://github.com/noname0310/babylon-mmd)
- [pixiv/three-vrm](https://github.com/pixiv/three-vrm/)

## License

[MIT](LICENSE.md)

This project is based on the code from [babylon-mmd](https://github.com/noname0310/babylon-mmd),
 [three.js](https://github.com/mrdoob/three.js/tree/r171) and [three-ts-types](https://github.com/three-types/three-ts-types/tree/r171) r171.
