import { Loader, OrbitControls } from '@react-three/drei'
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
        <OrbitControls />
        <Outlet />
      </Suspense>
    </Canvas>
  </>
)

export default App
