import type { SkinnedMesh } from 'three'

import { createMMDAnimationClip, MMDAnimationHelper, VMDLoader } from '@moeru/three-mmd'
import { buildMesh, PMDLoader } from '@moeru/three-mmd-b'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { LoaderUtils } from 'three'

import pmdUrl from '../../../../basic/src/assets/miku/miku_v2.pmd?url'
import vmdUrl from '../../../../basic/src/assets/vmds/wavefile_v2.vmd?url'

const BMesh = () => {
  const scene = useThree(({ scene }) => scene)

  const helper = new MMDAnimationHelper({ afterglow: 2 })
  const mmdLoader = new PMDLoader()
  const vmdLoader = new VMDLoader()

  useEffect(() => {
    let mesh: SkinnedMesh

    mmdLoader.load(pmdUrl, (pmx) => {
      // const geometry = buildGeometry(pmx)

      // mesh = new Mesh(geometry, new MeshNormalMaterial())
      // mesh.scale.set(0.1, 0.1, 0.1)
      // scene.add(mesh)
      mesh = buildMesh(pmx, LoaderUtils.extractUrlBase(pmdUrl))
      mesh.scale.set(0.1, 0.1, 0.1)
      scene.add(mesh)

      vmdLoader.load(vmdUrl, (vmd) => {
        const animation = createMMDAnimationClip(vmd, mesh)

        helper.add(mesh, {
          animation,
          physics: true,
        })
      })
    })

    return () => {
      if (mesh == null)
        return

      helper.remove(mesh)
      scene.remove(mesh)
    }
  })

  useFrame((_, delta) => helper.update(delta))

  return null
}

export default BMesh
