import { buildAnimation, buildCameraAnimation, MMDAnimationManager, MMDLoader, VMDLoader } from '@moeru/three-mmd'
import { initAmmo, MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'
import { AmbientLight, Audio, AudioListener, AudioLoader, Color, DirectionalLight, PerspectiveCamera, PolarGridHelper, Scene, Timer, WebGLRenderer } from 'three'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'

import audioFile from '../assets/audios/wavefile_short.mp3?url'
import modelFile from '../assets/miku/miku_v2.pmd?url'
import cameraFile from '../assets/vmds/wavefile_camera.vmd?url'
import vmdFile from '../assets/vmds/wavefile_v2.vmd?url'

const main = () => {
  let camera!: PerspectiveCamera
  let effect!: OutlineEffect
  let renderer!: WebGLRenderer
  let scene!: Scene

  let ready = false

  const delayTime = 160 / 30
  let manager!: MMDAnimationManager
  const timer = new Timer()

  const overlay = document.createElement('div')
  const startButton = document.createElement('button')
  startButton.textContent = 'Play'
  overlay.appendChild(startButton)
  document.body.appendChild(overlay)

  const render = () => {
    if (ready) {
      const delta = timer.getDelta()
      manager.update(delta)
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
    render()
  }

  const init = async () => {
    overlay.remove()

    const container = document.createElement('div')
    document.body.appendChild(container)

    camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000)

    scene = new Scene()
    scene.background = new Color(0xFFFFFF)

    scene.add(new PolarGridHelper(30, 0))

    const listener = new AudioListener()
    camera.add(listener)
    scene.add(camera)

    scene.add(new AmbientLight(0xAAAAAA, 3))

    const directionalLight = new DirectionalLight(0xFFFFFF, 3)
    directionalLight.position.set(-1, 1, 1).normalize()
    scene.add(directionalLight)

    renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setAnimationLoop(animate)
    container.appendChild(renderer.domElement)

    effect = new OutlineEffect(renderer)

    const loader = new MMDLoader().register(MMDAmmoPlugin)
    const vmdLoader = new VMDLoader()

    const [loadedMMD, vmd] = await Promise.all([
      loader.loadAsync(modelFile),
      vmdLoader.loadAsync(vmdFile),
    ])

    const cameraVmd = await vmdLoader.loadAsync(cameraFile)
    const buffer = await new AudioLoader().loadAsync(audioFile)

    const animation = buildAnimation(vmd, loadedMMD.mesh)
    const cameraAnimation = buildCameraAnimation(cameraVmd)
    const duration = Math.max(animation.duration, cameraAnimation.duration, buffer.duration + delayTime)

    const sound = new Audio(listener).setBuffer(buffer)

    manager = new MMDAnimationManager({ duration })
    manager.add(loadedMMD, { animation })
    manager.add(camera, { animation: cameraAnimation })
    manager.add(sound, { delayTime })

    scene.add(loadedMMD.mesh)
    ready = true

    window.addEventListener('resize', onWindowResize)
  }

  startButton.addEventListener('click', () => {
    void initAmmo().then(init)
  })
}

// eslint-disable-next-line @masknet/no-top-level
void main()
