import { Ammo } from '@moeru/three-mmd-r3f'
import { Environment, Loader, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Outlet } from 'react-router'

const App = () => (
  <>
    <Loader />
    <Canvas
      gl={{ localClippingEnabled: true }}
      style={{ height: '100dvh', touchAction: 'none', width: '100dvw' }}
    >
      <Suspense fallback={null}>
        <Ammo>
          <Outlet />
          <OrbitControls />
          <directionalLight intensity={1.64} position={[2.1, 0, 24]} rotation={[0, 2 * Math.PI, 0]} />
          <Environment background files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/belfast_sunset_puresky_2k.hdr" />
        </Ammo>
      </Suspense>
    </Canvas>
  </>
)

export default App
