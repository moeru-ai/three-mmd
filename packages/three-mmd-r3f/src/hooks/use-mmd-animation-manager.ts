import { MMDAnimationManager } from '@moeru/three-mmd'
import { useEffect, useMemo, useRef } from 'react'

type MMDAnimationManagerOptions = ConstructorParameters<typeof MMDAnimationManager>[0]
type MMDAnimationManagerSetup = (manager: MMDAnimationManager) => (() => void) | void

/** Creates a manager, runs setup once, and disposes it with the R3F component. */
const useMMDAnimationManager = (
  options?: MMDAnimationManagerOptions,
  setup?: MMDAnimationManagerSetup,
) => {
  const duration = options?.duration
  const manager = useMemo(() => new MMDAnimationManager({ duration }), [duration])
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
