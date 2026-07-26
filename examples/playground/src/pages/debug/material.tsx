import type { MMD } from '@moeru/three-mmd'

import { MMDLoader, MMDMaterialPlugin } from '@moeru/three-mmd'
import { MMDToonMaterial } from '@moeru/three-mmd/materials/toon'
import { startTransition, useEffect, useMemo, useState } from 'react'

import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'

const DebugMaterial = () => {
  const loader = useMemo(() => {
    const next = new MMDLoader()
    next.register(parser => new MMDMaterialPlugin(parser, { materialType: MMDToonMaterial }))
    return next
  }, [])
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

  return <primitive object={mmd.mesh} scale={0.1} />
}

export default DebugMaterial
