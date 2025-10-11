import { buildGeometry, buildMaterial, PMDLoader } from '@moeru/three-mmd-b'
import { usePMD } from '@moeru/three-mmd-r3f'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { LoaderUtils, Mesh } from 'three'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'

const BGeometry = () => {
  const scene = useThree(({ scene }) => scene)

  const old = usePMD(pmdUrl)

  const pmdLoader = new PMDLoader()

  useEffect(() => {
    let mesh: Mesh

    pmdLoader.load(pmdUrl, (pmx) => {
      const geometry = buildGeometry(pmx)
      const material = buildMaterial(pmx, geometry, LoaderUtils.extractUrlBase(pmdUrl))

      mesh = new Mesh(old.geometry, material)

      // mesh = new Mesh(geometry, new MeshNormalMaterial())
      // mesh.scale.set(0.1, 0.1, 0.1)
      // scene.add(mesh)
      mesh.scale.set(0.1, 0.1, 0.1)
      scene.add(mesh)
    })

    return () => {
      if (mesh == null)
        return

      scene.remove(mesh)
    }
  })

  return null
}

export default BGeometry
