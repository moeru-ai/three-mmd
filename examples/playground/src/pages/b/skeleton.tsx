import { MMDLoader } from '@moeru/three-mmd-b'
import { useMMD } from '@moeru/three-mmd-r3f'
import { useLoader } from '@react-three/fiber'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'

const BSkeleton = () => {
  const object = useMMD(pmdUrl)

  const bObject = useLoader(MMDLoader, pmdUrl)

  return (
    <>
      <primitive object={object} position={[3, 0, 0]} scale={0.1} />
      <skeletonHelper args={[object]} />
      <primitive object={bObject} position={[-3, 0, 0]} scale={0.1} />
      <skeletonHelper args={[bObject]} />
    </>
  )
}

export default BSkeleton
