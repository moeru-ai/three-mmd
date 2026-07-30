import type { AmmoModule } from './ammo-runtime'

import { ensureAmmo } from './ammo-runtime'

/**
 * Initializes the shared Ammo runtime.
 *
 * Call this before using MMDAmmoPhysics directly. MMDAmmoPlugin calls it
 * automatically from its asynchronous loader hook.
 */
export const initAmmo = async (): Promise<AmmoModule> => ensureAmmo()
