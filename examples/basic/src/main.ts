/* eslint-disable @masknet/no-top-level */
import {
  createMMDAnimationClip,
  initAmmo,
  MMDAnimationHelper,
  MMDLoader,
  MMDToonMaterial,
  VMDLoader,
} from '@moeru/three-mmd'
import {
  Clock,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  PerspectiveCamera,
  PolarGridHelper,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'
import Stats from 'three/addons/libs/stats.module.js'

import pmdUrl from './assets/miku/miku_v2.pmd?url'
import vmdUrl from './assets/vmds/wavefile_v2.vmd?url'
import './main.css'
import './app.css'
import { onError, onProgress } from './lib/loader'

// eslint-disable-next-line antfu/no-top-level-await
await initAmmo()

const clock = new Clock()

const container = document.createElement('div')
document.body.appendChild(container)

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000)
camera.position.z = 30

const scene = new Scene()
scene.background = new Color(0xFFFFFF)

const gridHelper = new PolarGridHelper(30, 0)
gridHelper.position.y = -10
scene.add(gridHelper)

// NOTICE: value tuned here for most of the MMD models
// made after or between 2021 to 2023, but it will be a bit dark
// for several models like the default Hatsune Miku, or way dark
// for known Miku V4C.
// const directionalLight = new DirectionalLight(0xFFFFFF, 2.85)
const directionalLight = new DirectionalLight(0xFFFFFF, 4.28)

// WORKAROUND: since tracing against target wasn't correctly implemented
// here the directional light pos & rotation was set for targeting the center
// of the model.
directionalLight.position.set(2.1, 0, 24)
directionalLight.rotation.set(0, 2 * Math.PI, 0)
scene.add(directionalLight)

const directionalLightHelper = new DirectionalLightHelper(directionalLight, undefined, 0x000000)
scene.add(directionalLightHelper)

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
// renderer.setAnimationLoop(animate)
container.appendChild(renderer.domElement)

const effect = new OutlineEffect(renderer)

const stats = new Stats()
document.body.appendChild(stats.dom)

const loader = new MMDLoader()
const vmdLoader = new VMDLoader()
const helper = new MMDAnimationHelper({ afterglow: 2.0 })

loader.load(
  pmdUrl,
  (mesh) => {
    mesh.position.y = -10

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        if (material instanceof MMDToonMaterial) {
          // TODO: if colored texture with special emissive values
          // then we should not really set this to default value of
          // 0x000000 (e.g. if the model has a part emits color
          // by it self, small battery supported light strips)
          //
          // https://github.com/mrdoob/three.js/issues/28336
          material.emissive?.set(0x000000)
        }
      }
    }
    scene.add(mesh)
    // TODO: directional light should follow the target but currently
    // it wasn't so we will just leave it as is right now but need
    // to implement this feature later
    // directionalLight.target = mesh

    vmdLoader.load(vmdUrl, (vmd) => {
      const animation = createMMDAnimationClip(vmd, mesh)

      helper.add(mesh, {
        animation,
        physics: true,
      })
    }, onProgress, onError)

    const ikHelper = helper.objects.get(mesh)!.ikSolver.createHelper()
    ikHelper.visible = false
    scene.add(ikHelper)

    const physicsHelper = helper.objects.get(mesh)!.physics!.createHelper()
    physicsHelper.visible = false
    scene.add(physicsHelper)

    const initGui = () => {
      const gui = new GUI()

      const guiControls = gui.addFolder('Controls')
      const lilStatesControls = {
        'Animation': true,
        'IK': true,
        'Outline': true,
        'Physics': true,
        'Show IK bones': false,
        'Show rigid bodies': false,
      }

      guiControls.add(lilStatesControls, 'Animation').onChange(() => {
        helper.enable('Animation', lilStatesControls.Animation)
      })

      guiControls.add(lilStatesControls, 'IK').onChange(() => {
        helper.enable('IK', lilStatesControls.IK)
      })

      guiControls.add(lilStatesControls, 'Outline').onChange(() => {
        effect.enabled = lilStatesControls.Outline
      })

      guiControls.add(lilStatesControls, 'Physics').onChange(() => {
        helper.enable('physics', lilStatesControls.Physics)
      })

      guiControls.add(lilStatesControls, 'Show IK bones').onChange(() => {
        ikHelper.visible = lilStatesControls['Show IK bones']
      })

      guiControls.add(lilStatesControls, 'Show rigid bodies').onChange(() => {
        physicsHelper.visible = lilStatesControls['Show rigid bodies']
      })

      const guiMesh = gui.addFolder('Mesh')
      const lilStatesMesh = {
        'Mesh X': mesh.position.x,
        'Mesh Y': mesh.position.y,
        'Mesh Z': mesh.position.z,
      }

      guiMesh.add(lilStatesMesh, 'Mesh X', -20, 20).onChange(() => {
        mesh.position.x = lilStatesMesh['Mesh X']
      })

      guiMesh.add(lilStatesMesh, 'Mesh Y', -20, 20).onChange(() => {
        mesh.position.y = lilStatesMesh['Mesh Y']
      })

      guiMesh.add(lilStatesMesh, 'Mesh Z', -20, 20).onChange(() => {
        mesh.position.z = lilStatesMesh['Mesh Z']
      })

      const guiDirectionalLight = gui.addFolder('Directional light')
      const lilStatesDirectionalLight = {
        'Directional light color': directionalLight.color.getHex(),
        'Directional light intensity': directionalLight.intensity,
        'Directional light rotate X': 0,
        'Directional light rotate Y': 2 * Math.PI,
        'Directional light rotate Z': 0,
        'Directional light X': 2.1,
        'Directional light Y': 0,
        'Directional light Z': 24,
      }

      guiDirectionalLight.addColor(lilStatesDirectionalLight, 'Directional light color').onChange(() => {
        directionalLight.color.set(lilStatesDirectionalLight['Directional light color'])
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light intensity', 0, 20).onChange(() => {
        directionalLight.intensity = lilStatesDirectionalLight['Directional light intensity']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light X', -50, 50).onChange(() => {
        directionalLight.position.x = lilStatesDirectionalLight['Directional light X']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light Y', -50, 50).onChange(() => {
        directionalLight.position.y = lilStatesDirectionalLight['Directional light Y']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light Z', -50, 50).onChange(() => {
        directionalLight.position.z = lilStatesDirectionalLight['Directional light Z']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light rotate X', -2 * Math.PI, 2 * Math.PI).onChange(() => {
        directionalLight.rotation.x = lilStatesDirectionalLight['Directional light rotate X']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light rotate Y', -2 * Math.PI, 2 * Math.PI).onChange(() => {
        directionalLight.rotation.y = lilStatesDirectionalLight['Directional light rotate Y']
      })

      guiDirectionalLight.add(lilStatesDirectionalLight, 'Directional light rotate Z', -2 * Math.PI, 2 * Math.PI).onChange(() => {
        directionalLight.rotation.z = lilStatesDirectionalLight['Directional light rotate Z']
      })
    }

    initGui()
  },
  onProgress,
  onError,
)

const controls = new OrbitControls(camera, renderer.domElement)
controls.minDistance = 10
controls.maxDistance = 100

const render = () => {
  helper.update(clock.getDelta())
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
