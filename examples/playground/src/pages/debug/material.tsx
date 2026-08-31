import type { MMD } from '@moeru/three-mmd'

import { MMDLoader, MMDMaterialPlugin } from '@moeru/three-mmd'
import { MMDPhysicalMaterial } from '@moeru/three-mmd/materials/physical'
import { MMDToonMaterial } from '@moeru/three-mmd/materials/toon'
import { useControls } from 'leva'
import { startTransition, useEffect, useMemo, useState } from 'react'

import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugMaterial = () => {
  const { backend } = useControls('Material', {
    backend: {
      label: 'Backend',
      options: {
        Physical: 'physical',
        Toon: 'toon',
      },
      value: 'toon',
    },
  })
  const materialType = backend === 'physical' ? MMDPhysicalMaterial : MMDToonMaterial
  const loader = useMemo(() => {
    const next = new MMDLoader()
    next.register(parser => new MMDMaterialPlugin(parser, { materialType }))
    return next
  }, [materialType])
  const [mmd, setMmd] = useState<MMD>()

  useEffect(() => {
    let active = true
    void loader.loadAsync(pmxUrl).then((loaded) => {
      if (!active)
        return

      startTransition(() => setMmd(loaded))
    })
    return () => {
      active = false
    }
  }, [loader])

  if (mmd === undefined)
    return null

  return <primitive object={mmd.mesh} position={[0, -1, 0]} scale={0.1} />
}

export default DebugMaterial
