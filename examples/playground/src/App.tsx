import type { ThreeElements } from '@react-three/fiber'
import type { Mesh } from 'three'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'

const Box = (props: ThreeElements['mesh']) => {
  const ref = useRef<Mesh>(null)

  const [hovered, hover] = useState(false)
  const [clicked, click] = useState(false)

  useFrame((_state, delta) => {
    if (ref.current)
      ref.current.rotation.x += delta
  })

  return (
    <mesh
      data-test-id="box"
      {...props}
      onClick={() => click(!clicked)}
      onPointerOut={() => hover(false)}
      onPointerOver={() => hover(true)}
      ref={ref}
      // eslint-disable-next-line @masknet/jsx-no-logical
      scale={clicked ? 1.5 : 1}
    >
      <boxGeometry args={[1, 1, 1]} />
      {/* eslint-disable-next-line @masknet/jsx-no-logical */}
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

export const App = () => (
  <Canvas>
    <ambientLight intensity={Math.PI / 2} />
    <spotLight angle={0.15} decay={0} intensity={Math.PI} penumbra={1} position={[10, 10, 10]} />
    <pointLight decay={0} intensity={Math.PI} position={[-10, -10, -10]} />
    <Box position={[-1.2, 0, 0]} />
    <Box position={[1.2, 0, 0]} />
  </Canvas>
)
