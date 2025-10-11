import { buildMesh, PMDLoader } from '@moeru/three-mmd-b'
import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { LoaderUtils } from 'three'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'

const BMesh = () => {
  const pmx = useLoader(PMDLoader, pmdUrl)
  const object = useMemo(() => buildMesh(pmx, LoaderUtils.extractUrlBase(pmdUrl)), [pmx])

  return (
    <primitive object={object} rotation={[0, Math.PI, 0]} scale={0.1} />
  )
}

export default BMesh
