import type { SkinnedMesh } from 'three'

export const processBones = () => {
  let backupBones: Float32Array | undefined

  const restoreBones = (mesh: SkinnedMesh) => {
    if (backupBones === undefined)
      return

    mesh.skeleton.bones.forEach((bone, i) => {
      bone.position.fromArray(backupBones!, i * 7)
      bone.quaternion.fromArray(backupBones!, i * 7 + 3)
    })
  }

  /*
   * Avoiding these two issues by restore/save bones before/after mixer animation.
   *
   * 1. PropertyMixer used by AnimationMixer holds cache value in .buffer.
   *    Calculating IK, Grant, and Physics after mixer animation can break
   *    the cache coherency.
   *
   * 2. Applying Grant two or more times without reset the posing breaks model.
   */
  const saveBones = (mesh: SkinnedMesh) => {
    const bones = mesh.skeleton.bones

    if (backupBones === undefined)
      backupBones = new Float32Array(bones.length * 7)

    mesh.skeleton.bones.forEach((bone, i) => {
      bone.position.toArray(backupBones!, i * 7)
      bone.quaternion.toArray(backupBones!, i * 7 + 3)
    })
  }

  return { restoreBones, saveBones }
}
