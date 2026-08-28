import type { Group } from 'three'

import { AccumulativeShadows, Environment, Float, Lightformer, Loader, OrbitControls, PerformanceMonitor, RandomizedLight, Stats } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Color, Depth, LayerMaterial } from 'lamina'
import { Leva } from 'leva'
import { Suspense, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { BackSide } from 'three'

const Lightformers = ({ positions = [2, 0, 2, 0, 2, 0, 2, 0] }) => {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current == null)
      return

    groupRef.current.position.z += delta * 10
    if (groupRef.current.position.z > 20)
      groupRef.current.position.z = -60
  })

  return (
    <>
      {/* Ceiling */}
      <Lightformer intensity={0.75} position={[0, 5, -9]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      <group rotation={[0, 0.5, 0]}>
        <group ref={groupRef}>
          {positions.map((x, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Lightformer form="circle" intensity={2} key={i} position={[x, 4, i * 4]} rotation={[Math.PI / 2, 0, 0]} scale={[3, 1, 1]} />
          ))}
        </group>
      </group>
      {/* Sides */}
      <Lightformer intensity={4} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 0.1, 1]} />
      <Lightformer position={[-5, -1, -1]} rotation-y={Math.PI / 2} scale={[20, 0.5, 1]} />
      <Lightformer position={[10, 1, 0]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
      {/* Accent (red) */}
      <Float floatIntensity={2} rotationIntensity={2} speed={5}>
        <Lightformer color="red" form="ring" intensity={1} position={[-15, 4, -18]} scale={10} target={[0, 0, 0]} />
      </Float>
      {/* Background */}
      <mesh scale={100}>
        <sphereGeometry args={[1, 64, 64]} />
        <LayerMaterial side={BackSide}>
          <Color alpha={1} color="#444" mode="normal" />
          <Depth alpha={0.5} colorA="blue" colorB="black" far={300} mode="normal" near={0} origin={[100, 100, 100]} />
        </LayerMaterial>
      </mesh>
    </>
  )
}

const App = () => {
  const [degraded, setDegraded] = useState(false)
  const environmentResolution = degraded ? 128 : 256

  return (
    <>
      <Leva />
      <Stats />
      <Loader />
      <Canvas
        camera={{ fov: 45, position: [0, 0, 3] }}
        gl={{ localClippingEnabled: true }}
        shadows
        style={{ height: '100dvh', touchAction: 'none', width: '100dvw' }}
      >
        <Suspense fallback={null}>
          <Outlet />
          <spotLight angle={0.3} castShadow intensity={2} penumbra={1} position={[0, 15, 0]} shadow-bias={-0.0001} />
          <ambientLight intensity={0.5} />
          <AccumulativeShadows alphaTest={0.9} frames={100} opacity={0.35} position={[0, -1.16, 0]} scale={10}>
            <RandomizedLight ambient={0.5} amount={8} position={[1, 5, -1]} radius={10} />
          </AccumulativeShadows>
          {/** PerfMon will detect performance issues */}
          <PerformanceMonitor onDecline={() => setDegraded(true)} />
          {/* Renders contents "live" into a HDRI environment (scene.environment). */}
          <Environment background blur={1} environmentIntensity={2} frames={Infinity} resolution={environmentResolution}>
            <Lightformers />
          </Environment>
          <OrbitControls />
        </Suspense>
      </Canvas>
    </>
  )
}

export default App
