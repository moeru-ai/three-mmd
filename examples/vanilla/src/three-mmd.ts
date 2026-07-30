import type { MMD, MMDIKHelper } from '@moeru/three-mmd'
import type { AnimationAction, Object3D } from 'three'

import Stats from 'three/examples/jsm/libs/stats.module.js'

import { buildAnimation, MMDLoader, VMDLoader } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'
import { AmbientLight, AnimationMixer, Color, DirectionalLight, PerspectiveCamera, PolarGridHelper, Scene, Timer, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'

import modelFile from './assets/miku/miku_v2.pmd?url'
import vmdFile from './assets/vmds/wavefile_v2.vmd?url'

const main = async () => {
  let stats!: Stats
  let camera!: PerspectiveCamera
  let effect!: OutlineEffect
  let renderer!: WebGLRenderer
  let scene!: Scene
  let mmd: MMD | undefined
  let mixer: AnimationMixer | undefined
  let animationAction: AnimationAction | undefined
  let ikHelper!: MMDIKHelper
  let physicsHelper: Object3D | undefined
  let animationEnabled = true
  let ikEnabled = true
  let physicsEnabled = true

  const timer = new Timer()

  const render = () => {
    const delta = timer.getDelta()

    if (mmd !== undefined && mixer !== undefined) {
      mmd.updateWithMixer(delta, mixer, {
        ik: ikEnabled,
        physics: physicsEnabled,
      })
    }

    effect.render(scene, camera)
  }

  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()

    effect.setSize(window.innerWidth, window.innerHeight)
  }

  const animate = (time: number) => {
    timer.update(time)
    stats.begin()
    render()
    stats.end()
  }

  const init = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000)
    camera.position.z = 30

    // scene
    scene = new Scene()
    scene.background = new Color(0xFFFFFF)

    const gridHelper = new PolarGridHelper(30, 0)
    gridHelper.position.y = -10
    scene.add(gridHelper)

    const ambient = new AmbientLight(0xAAAAAA, 3)
    scene.add(ambient)

    const directionalLight = new DirectionalLight(0xFFFFFF, 3)
    directionalLight.position.set(-1, 1, 1).normalize()
    scene.add(directionalLight)

    renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setAnimationLoop(animate)
    container.appendChild(renderer.domElement)

    effect = new OutlineEffect(renderer)

    // STATS
    stats = new Stats()
    container.appendChild(stats.dom)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 10
    controls.maxDistance = 100

    window.addEventListener('resize', onWindowResize)

    // model
    const onProgress = (xhr: ProgressEvent) => {
      if (!xhr.lengthComputable)
        return
      const percentComplete = xhr.loaded / xhr.total * 100
      // eslint-disable-next-line no-console
      console.log(`${Math.round(percentComplete)}% downloaded`)
    }

    const initGui = () => {
      const api = {
        'animation': animationEnabled,
        'ik': ikEnabled,
        'outline': true,
        'physics': physicsEnabled,
        'show IK bones': false,
        'show rigid bodies': false,
      }

      const gui = new GUI()

      gui.add(api, 'animation').onChange(() => {
        animationEnabled = api.animation
        if (animationAction !== undefined)
          animationAction.paused = !animationEnabled
      })

      gui.add(api, 'ik').onChange(() => {
        ikEnabled = api.ik
      })

      gui.add(api, 'outline').onChange(() => {
        effect.enabled = api.outline
      })

      gui.add(api, 'physics').onChange(() => {
        physicsEnabled = api.physics
      })

      gui.add(api, 'show IK bones').onChange(() => {
        ikHelper.visible = api['show IK bones']
      })

      gui.add(api, 'show rigid bodies').onChange(() => {
        if (physicsHelper === undefined)
          return
        physicsHelper.visible = api['show rigid bodies']
      })
    }

    const loader = new MMDLoader().register(MMDAmmoPlugin)
    const vmdLoader = new VMDLoader()

    const [loadedMMD, vmd] = await Promise.all([
      loader.loadAsync(modelFile, onProgress),
      vmdLoader.loadAsync(vmdFile),
    ])

    mmd = loadedMMD
    mmd.mesh.position.y = -10
    scene.add(mmd.mesh)

    mixer = new AnimationMixer(mmd.mesh)
    animationAction = mixer.clipAction(buildAnimation(vmd, mmd.mesh)).play()

    ikHelper = mmd.ikSolver.createHelper()
    ikHelper.visible = false
    // eslint-disable-next-line @masknet/type-no-force-cast-via-top-type
    scene.add(ikHelper as unknown as Object3D)

    physicsHelper = mmd.physics?.createHelper<Object3D>()
    if (physicsHelper !== undefined) {
      physicsHelper.visible = false
      scene.add(physicsHelper)
    }

    initGui()

    animationAction.paused = !animationEnabled
  }

  await init()
}

// eslint-disable-next-line @masknet/no-top-level
void main()
