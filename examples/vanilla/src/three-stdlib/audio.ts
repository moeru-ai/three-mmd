import type { AnimationClip } from 'three'

import Ammo from 'ammojs-typed'

import { AmbientLight, Audio, AudioListener, AudioLoader, Color, DirectionalLight, PerspectiveCamera, PolarGridHelper, Scene, Timer, WebGLRenderer } from 'three'
import { MMDAnimationHelper, MMDLoader } from 'three-stdlib'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'

import audioFile from '../assets/audios/wavefile_short.mp3?url'
import modelFile from '../assets/miku/miku_v2.pmd?url'
import cameraFile from '../assets/vmds/wavefile_camera.vmd?url'
import vmdFile from '../assets/vmds/wavefile_v2.vmd?url'

const main = async () => {
  let camera!: PerspectiveCamera
  let effect!: OutlineEffect
  let renderer!: WebGLRenderer
  let scene!: Scene
  let helper!: MMDAnimationHelper

  let ready = false

  const timer = new Timer()

  const overlay = document.createElement('div')
  const startButton = document.createElement('button')
  startButton.textContent = 'Play'
  overlay.appendChild(startButton)
  document.body.appendChild(overlay)

  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()

    effect.setSize(window.innerWidth, window.innerHeight)
  }

  const animate = (time: number) => {
    timer.update(time)

    if (ready)
      helper.update(timer.getDelta())

    effect.render(scene, camera)
  }

  const init = () => {
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

    const audioParams = { delayTime: 160 / 30 }
    helper = new MMDAnimationHelper()

    const loader = new MMDLoader()

    loader.loadWithAnimation(modelFile, [vmdFile], (mmd) => {
      helper.add(mmd.mesh, {
        animation: mmd.animation,
        physics: true,
      })

      loader.loadAnimation(cameraFile, camera, (cameraAnimation) => {
        helper.add(camera, {
          animation: cameraAnimation as AnimationClip,
        })

        new AudioLoader().load(audioFile, (buffer) => {
          const audio = new Audio(listener).setBuffer(buffer)
          helper.add(audio, audioParams)

          scene.add(mmd.mesh)
          ready = true
        })
      })
    })

    window.addEventListener('resize', onWindowResize)
  }

  startButton.addEventListener('click', () => {
    void Ammo.bind(Ammo)(Ammo).then((AmmoLib) => {
      Object.assign(globalThis, { Ammo: AmmoLib })
      init()
    })
  })
}

// eslint-disable-next-line @masknet/no-top-level
void main()
