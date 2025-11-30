import type { SkinnedMesh } from 'three'

import { useControls } from 'leva'
import { startTransition, useEffect, useMemo, useState } from 'react'

import pmxUrl from '../../../../assets/げのげ式初音ミク/げのげ式初音ミク.pmx?url'
import { useMMDLoader } from '../../hooks/use-mmd-loader'

const Mesh = () => {
  const MMDLoader = useMMDLoader()
  const loader = useMemo(() => new MMDLoader(), [MMDLoader])

  const [object, setObject] = useState<SkinnedMesh>()

  useEffect(() => startTransition(async () => setObject(await loader.loadAsync(pmxUrl))), [loader])

  const { showSkeleton } = useControls({
    showSkeleton: false,
  })

  if (object == null)
    return

  return (
    <>
      <primitive
        object={object}
        // rotation={[0, Math.PI, 0]}
        scale={0.1}
      />
      {showSkeleton && (
        <skeletonHelper
          args={[object]}
        />
      )}
    </>
  )
}

export default Mesh
