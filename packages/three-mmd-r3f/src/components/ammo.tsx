import type { PropsWithChildren } from 'react'

import { initAmmo } from '@moeru/three-mmd'
import { suspend } from 'suspend-react'

export const Ammo = ({ children }: PropsWithChildren) => {
  suspend(initAmmo, ['@moeru/three-mmd-r3f', initAmmo])

  return (
    <>
      { children }
    </>
  )
}
