import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Outlet } from 'react-router'

const App = () => (
  <>
    <Loader />
    <Canvas
      gl={{ localClippingEnabled: true }}
      style={{ flexGrow: 1, width: '100%' }}
    >
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </Canvas>
  </>
)

export default App
