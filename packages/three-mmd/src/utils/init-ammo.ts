import Ammo from 'ammojs-typed'

// https://github.com/giniedp/ammojs-typed/issues/18
export const initAmmo = async () => Ammo.bind(Ammo)(Ammo)
