import { MMDAnimationManager } from '@moeru/three-mmd'
import { useEffect, useMemo } from 'react'

/** Creates an MMD animation manager and disposes it with the R3F component. */
const useMMDAnimationManager = () => {
  const manager = useMemo(() => new MMDAnimationManager(), [])

  useEffect(() => () => manager.dispose(), [manager])

  return manager
}

export { useMMDAnimationManager }
