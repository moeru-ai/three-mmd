import type { MMDLoaderPluginFactory } from '@moeru/three-mmd'

import { MMDLoader, MMDMaterialPlugin } from '@moeru/three-mmd'
import { MMDAmmoPlugin } from '@moeru/three-mmd-physics-ammo'
import { MMDSpringBonePlugin } from '@moeru/three-mmd-physics-springbone'
import { MMDPhysicalMaterial } from '@moeru/three-mmd/materials/physical'
import { MMDToonMaterial } from '@moeru/three-mmd/materials/toon'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo } from 'react'

export const useMMDWithDebug = (pmxUrl: string) => {
  const { material, physics } = useControls('Loader', {
    material: {
      label: 'Material',
      options: {
        Physical: 'physical',
        Toon: 'toon',
      },
      value: 'toon',
    },
    physics: {
      label: 'Physics',
      options: {
        Ammo: 'ammo',
        Off: 'off',
        SpringBone: 'spring-bone',
      },
      value: 'ammo',
    },
  })

  const PhysicsPlugin = useMemo(() => {
    if (physics === 'ammo')
      return MMDAmmoPlugin
    else if (physics === 'spring-bone')
      return MMDSpringBonePlugin
    else
      // eslint-disable-next-line ts/no-unnecessary-type-assertion
      return (() => () => ({ name: 'off' })) as MMDLoaderPluginFactory
  }, [physics])

  const MaterialPlugin = useMemo(() =>
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    (parser => new MMDMaterialPlugin(parser, { materialType: material === 'physical' ? MMDPhysicalMaterial : MMDToonMaterial })) as MMDLoaderPluginFactory, [material])

  useEffect(() => useLoader.clear(MMDLoader, pmxUrl), [pmxUrl, PhysicsPlugin, MaterialPlugin])

  return useLoader(MMDLoader, pmxUrl, loader => loader
    .register(PhysicsPlugin)
    .register(MaterialPlugin))
}
