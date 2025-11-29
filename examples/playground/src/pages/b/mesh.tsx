import { threeMMDLoader } from '@moeru/three-mmd-b'
import { useLoader } from '@react-three/fiber'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'

const BMesh = () => {
  const object = useLoader(threeMMDLoader, pmdUrl)

  return (
    <>
      <primitive
        object={object}
        rotation={[0, Math.PI, 0]}
        scale={0.1}
      />
      <skeletonHelper
        args={[object.mesh]}
      />
    </>
  )
}

export default BMesh
