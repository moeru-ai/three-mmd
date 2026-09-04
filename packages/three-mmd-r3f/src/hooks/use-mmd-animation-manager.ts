import { MMDAnimationManager } from '@moeru/three-mmd'
import { useEffect, useMemo, useRef } from 'react'

type MMDAnimationManagerSetup = (manager: MMDAnimationManager) => (() => void) | void

/** Creates a manager, runs setup once, and disposes it with the R3F component. */
const useMMDAnimationManager = (setup?: MMDAnimationManagerSetup) => {
  const manager = useMemo(() => new MMDAnimationManager(), [])
  const setupRef = useRef(setup)

  useEffect(() => {
    const cleanup = setupRef.current?.(manager)

    return () => {
      if (typeof cleanup === 'function')
        cleanup()
      manager.dispose()
    }
  }, [manager])

  return manager
}

export { useMMDAnimationManager }
