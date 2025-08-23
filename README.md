# `@moeru/three-mmd`

Use MMD on Three.js

## About

`MMDLoader` having been removed in three.js r172 nearly ten months ago,
and no code has ever appeared in the [takahirox/three-mmd-loader](https://github.com/takahirox/three-mmd-loader) repository.

Considering the needs of Project AIRI or other future projects, I decided to fork and maintain it, i.e., this repo.

## Usage

```bash
npm i three @moeru/three-mmd
npm i -D @types/three
```

> There may be significant changes in future versions, so this is unstable.

```ts
import { MMDLoader } from '@moeru/three-mmd'
import * as THREE from 'three'

const scene = new THREE.Scene()

const loader = new MMDLoader()

loader.load(
  // URL of the model you want to load
  '/models/miku_v2.pmd',
  // called when the resource is loaded
  mesh => scene.add(mesh),
  // called while loading is progressing
  progress => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
  // called when loading has errors
  error => console.error(error),
)
```

## License

[MIT](LICENSE.md)

This project is based on the code from [three.js](https://github.com/mrdoob/three.js/tree/r171) and [three-ts-types](https://github.com/three-types/three-ts-types/tree/r171) r171.
