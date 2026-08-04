import type { Object3D, SkinnedMesh } from 'three'

import Ammo from 'ammojs-typed'
import Stats from 'three/examples/jsm/libs/stats.module.js'

import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, PolarGridHelper, Scene, Timer, WebGLRenderer } from 'three'
import { MMDAnimationHelper, MMDLoader } from 'three-stdlib'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'

import modelFile from '../assets/miku/miku_v2.pmd?url'
import vmdFile from '../assets/vmds/wavefile_v2.vmd?url'

const main = async () => {
  let stats!: Stats
  let camera!: PerspectiveCamera
  let effect!: OutlineEffect
  let mesh!: SkinnedMesh
  let renderer!: WebGLRenderer
  let scene!: Scene
  let helper!: MMDAnimationHelper
  let ikHelper!: Object3D
  let physicsHelper: Object3D | undefined

  const timer = new Timer()

  const render = () => {
    helper.update(timer.getDelta())
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

  const init = () => {
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

    // model
    helper = new MMDAnimationHelper({
      afterglow: 2.0,
    })

    const loader = new MMDLoader()

    const initGui = () => {
      const api = {
        'animation': true,
        'ik': true,
        'outline': true,
        'physics': true,
        'show IK bones': false,
        'show rigid bodies': false,
      }

      const gui = new GUI()

      gui.add(api, 'animation').onChange(() => {
        helper.enable('animation', api.animation)
      })

      gui.add(api, 'ik').onChange(() => {
        helper.enable('ik', api.ik)
      })

      gui.add(api, 'outline').onChange(() => {
        effect.enabled = api.outline
      })

      gui.add(api, 'physics').onChange(() => {
        helper.enable('physics', api.physics)
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

    loader.loadWithAnimation(modelFile, [vmdFile], (mmd) => {
      mesh = mmd.mesh
      mesh.position.y = -10
      scene.add(mesh)

      helper.add(mesh, {
        animation: mmd.animation,
        physics: true,
      })

      const object = helper.objects.get(mesh)!

      ikHelper = object.ikSolver.createHelper()
      ikHelper.visible = false
      scene.add(ikHelper)

      physicsHelper = object.physics!.createHelper()
      physicsHelper.visible = false
      scene.add(physicsHelper)

      initGui()
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 10
    controls.maxDistance = 100

    window.addEventListener('resize', onWindowResize)
  }

  void Ammo.bind(Ammo)(Ammo).then((AmmoLib) => {
    Object.assign(globalThis, { Ammo: AmmoLib })
    init()
  })
}

// eslint-disable-next-line @masknet/no-top-level
void main()
