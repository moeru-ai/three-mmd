import { useLoader } from '@react-three/fiber'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'
import { useMMDLoader } from '../../hooks/use-mmd-loader'

const Mesh = () => {
  const MMDLoader = useMMDLoader()
  const object = useLoader(MMDLoader, pmdUrl)

  return (
    <>
      <primitive
        object={object}
        rotation={[0, Math.PI, 0]}
        scale={0.1}
      />
      <skeletonHelper
        args={[object]}
      />
    </>
  )
}

export default Mesh
