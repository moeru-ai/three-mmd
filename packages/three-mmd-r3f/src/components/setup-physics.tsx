import type { PropsWithChildren } from 'react'

import { suspend } from 'suspend-react'

export interface SetupPhysicsOptions {
  setup: () => Promise<unknown>
}

export const SetupPhysics = ({ children, setup }: PropsWithChildren<SetupPhysicsOptions>) => {
  suspend(setup, ['@moeru/three-mmd-r3f', setup])

  return (
    <>
      { children }
    </>
  )
}
