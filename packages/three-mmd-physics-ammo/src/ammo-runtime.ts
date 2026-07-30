import AmmoFactory from 'ammojs-typed'

export type AmmoModule = typeof AmmoFactory

const ammoState: {
  initialization?: Promise<AmmoModule>
  initialized?: AmmoModule
} = {}

const isInitialized = (value: AmmoModule): boolean =>
  typeof value.btDiscreteDynamicsWorld === 'function'

export const ensureAmmo = async (): Promise<AmmoModule> => {
  if (ammoState.initialized)
    return ammoState.initialized

  if (isInitialized(AmmoFactory)) {
    ammoState.initialized = AmmoFactory
    return ammoState.initialized
  }

  ammoState.initialization ??= AmmoFactory.bind(AmmoFactory)(AmmoFactory)
    .then((ammo) => {
      ammoState.initialized = ammo
      return ammo
    })

  return ammoState.initialization
}

export const getAmmo = (): AmmoModule => {
  if (ammoState.initialized)
    return ammoState.initialized

  if (isInitialized(AmmoFactory)) {
    ammoState.initialized = AmmoFactory
    return ammoState.initialized
  }

  throw new Error(
    'MMDAmmoPhysics: Ammo is not initialized. Register MMDAmmoPlugin on MMDLoader so initialization can finish before the model is built.',
  )
}
