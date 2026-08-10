import { Environment, Loader, OrbitControls, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Leva } from 'leva'
import { Suspense } from 'react'
import { Outlet } from 'react-router'

const App = () => (
  <>
    <Leva />
    <Stats />
    <Loader />
    <Canvas
      camera={{ fov: 45, position: [0, 0, 3] }}
      gl={{ localClippingEnabled: true }}
      style={{ height: '100dvh', touchAction: 'none', width: '100dvw' }}
    >
      <Suspense fallback={null}>
        <Outlet />
        <OrbitControls />
        <directionalLight intensity={1.64} position={[2.1, 0, 24]} rotation={[0, 2 * Math.PI, 0]} />
        <Environment background files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/belfast_sunset_puresky_2k.hdr" />
      </Suspense>
    </Canvas>
  </>
)

export default App
