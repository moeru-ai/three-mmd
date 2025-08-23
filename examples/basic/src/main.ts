/* eslint-disable @masknet/no-top-level */
import { MMDLoader } from '@moeru/three-mmd'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  PolarGridHelper,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import Stats from 'three/addons/libs/stats.module.js'

import pmdUrl from './assets/miku/miku_v2.pmd?url'
// import vmdUrl from './assets/vmds/wavefile_v2.vmd?url'
import './main.css'
import './app.css'

// await Ammo(Ammo)
//   .then(() => {
//     const v2 = new Ammo.btVector3(1, 2, 3) // <-- works
//   })

const container = document.createElement('div')
document.body.appendChild(container)

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000)
camera.position.z = 30

const scene = new Scene()
scene.background = new Color(0xFFFFFF)

const gridHelper = new PolarGridHelper(30, 0)
gridHelper.position.y = -10
scene.add(gridHelper)

const ambient = new AmbientLight(0xAAAAAA, 3)
scene.add(ambient)

const directionalLight = new DirectionalLight(0xFFFFFF, 3)
directionalLight.position.set(-1, 1, 1).normalize()
scene.add(directionalLight)

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
// renderer.setAnimationLoop(animate)
container.appendChild(renderer.domElement)

const effect = new OutlineEffect(renderer)

const stats = new Stats()
document.body.appendChild(stats.dom)

const loader = new MMDLoader()
// const helper = new MMDAnimationHelper({ afterglow: 2.0 })

loader.load(
  pmdUrl,
  (mesh) => {
    // const mesh = mmd.mesh
    mesh.position.y = -10
    scene.add(mesh)
  },
  (xhr) => {
    if (!(xhr.lengthComputable))
      return
    const percentComplete = xhr.loaded / xhr.total * 100
    // eslint-disable-next-line no-console
    console.log(`${Math.round(percentComplete)}% downloaded`)
  },
)

const controls = new OrbitControls(camera, renderer.domElement)
controls.minDistance = 10
controls.maxDistance = 100

const render = () => {
  // renderer.render(scene, camera)
  effect.render(scene, camera)
}

const animate = () => {
  // eslint-disable-next-line @masknet/prefer-timer-id
  requestAnimationFrame(animate)

  render()

  stats.update()
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  // renderer.setSize(window.innerWidth, window.innerHeight)
  effect.setSize(window.innerWidth, window.innerHeight)
  render()
}, false)

animate()
