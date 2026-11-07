import { buildAnimation, MMDAnimationManager, MMDLoader, MMDMaterialPlugin, VMDLoader } from '@moeru/three-mmd'
import { MMDToonNodeMaterial } from '@moeru/three-mmd/materials/toon-node'
import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, Timer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { WebGPURenderer } from 'three/webgpu'

import modelFile from '../assets/miku/miku_v2.pmd?url'
import vmdFile from '../assets/vmds/wavefile_v2.vmd?url'

const main = async () => {
  // ?forceWebGL runs WebGPURenderer on its WebGL2 backend.
  const forceWebGL = new URLSearchParams(location.search).has('forceWebGL')

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000)
  camera.position.z = 30

  const scene = new Scene()
  scene.background = new Color(0xFFFFFF)
  scene.add(new AmbientLight(0xAAAAAA, 3))

  const directionalLight = new DirectionalLight(0xFFFFFF, 3)
  directionalLight.position.set(-1, 1, 1).normalize()
  scene.add(directionalLight)

  const renderer = new WebGPURenderer({ antialias: true, forceWebGL })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  await renderer.init()
  document.body.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.minDistance = 10
  controls.maxDistance = 100

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const loader = new MMDLoader().register(parser => new MMDMaterialPlugin(parser, { materialType: MMDToonNodeMaterial }))
  const [mmd, vmd] = await Promise.all([
    loader.loadAsync(modelFile),
    new VMDLoader().loadAsync(vmdFile),
  ])

  mmd.mesh.position.y = -10
  scene.add(mmd.mesh)

  const manager = new MMDAnimationManager()
  manager.add(mmd, { animation: buildAnimation(vmd, mmd.mesh) })

  const timer = new Timer()
  void renderer.setAnimationLoop((time) => {
    timer.update(time)
    manager.update(timer.getDelta())
    renderer.render(scene, camera)
  })
}

// eslint-disable-next-line @masknet/no-top-level
void main()
