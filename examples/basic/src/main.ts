/* eslint-disable @masknet/no-top-level */
import { initAmmo, MMDAnimationHelper, MMDLoader } from '@moeru/three-mmd'
import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
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

// eslint-disable-next-line antfu/no-top-level-await
await initAmmo()
  .then(() => {
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
    const helper = new MMDAnimationHelper({ afterglow: 2.0 })

    loader.loadWithAnimation(
      pmdUrl,
      [vmdUrl],
      (mmd) => {
        const mesh = mmd.mesh
        mesh.position.y = -10
        scene.add(mesh)

        helper.add(mesh, {
          animation: mmd.animation,
          physics: true,
        })

        const ikHelper = helper.objects.get(mesh)!.ikSolver.createHelper()
        ikHelper.visible = false
        scene.add(ikHelper)

        const physicsHelper = helper.objects.get(mesh)!.physics!.createHelper()
        physicsHelper.visible = false
        scene.add(physicsHelper)

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
            physicsHelper.visible = api['show rigid bodies']
          })
        }

        initGui()
      },
      (xhr) => {
        if (!(xhr.lengthComputable))
          return
        const percentComplete = xhr.loaded / xhr.total * 100
        // eslint-disable-next-line no-console
        console.log(`${Math.round(percentComplete)}% downloaded`)
      },
      err => console.error(err),
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
  })
