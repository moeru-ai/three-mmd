import type { Bone, SkinnedMesh } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Matrix4, Quaternion, Vector3 } from 'three'

interface AppliedPose {
  basePosition: Vector3
  baseRotation: Quaternion
  outputPosition: Vector3
  outputRotation: Quaternion
}

interface GrantEntry {
  affectPosition: boolean
  affectRotation: boolean
  appendPosition: Vector3
  appendRotation: Quaternion
  index: number
  isLocal: boolean
  parentIndex: number
  processed: boolean
  ratio: number
  transformOrder: number
}

// https://github.com/noname0310/babylon-mmd/blob/2ee0cee9fb744ab71f2cb6631c94d4338580814c/src/Runtime/appendTransformSolver.ts
/** @internal */
export class GrantSolver {
  public readonly mesh: SkinnedMesh

  private readonly appendQuaternion = new Quaternion()
  private readonly appliedPoses = new Map<number, AppliedPose>()
  private readonly entries: GrantEntry[]
  private readonly entriesByIndex: Array<GrantEntry | undefined>
  private readonly identityQuaternion = new Quaternion()
  private readonly ikRotations: readonly Quaternion[]
  private readonly restPositions: Vector3[]
  private readonly skinMatrix = new Matrix4()
  private readonly sourceRotation = new Quaternion()
  private readonly worldPosition = new Vector3()
  private readonly worldQuaternion = new Quaternion()
  private readonly worldScale = new Vector3()

  constructor(mesh: SkinnedMesh, pmx: PmxObject, ikRotations?: Quaternion[]) {
    this.mesh = mesh

    const bones = mesh.skeleton.bones
    if (bones.length < pmx.bones.length) {
      throw new RangeError(
        `GrantSolver: skeleton has ${bones.length} bones, but PMX contains ${pmx.bones.length}.`,
      )
    }
    if (mesh.skeleton.boneInverses.length < pmx.bones.length) {
      throw new RangeError(
        `GrantSolver: skeleton has ${mesh.skeleton.boneInverses.length} inverse bind matrices, but PMX contains ${pmx.bones.length} bones.`,
      )
    }

    this.ikRotations = ikRotations ?? Array.from({ length: pmx.bones.length }, () => new Quaternion())
    if (this.ikRotations.length < pmx.bones.length) {
      throw new RangeError(
        `GrantSolver: IK rotation state has ${this.ikRotations.length} entries, but PMX contains ${pmx.bones.length} bones.`,
      )
    }

    this.restPositions = bones.map(bone => bone.position.clone())
    this.entriesByIndex = Array.from({ length: pmx.bones.length })
    this.entries = []

    pmx.bones.forEach((bone, index) => {
      const appendTransform = bone.appendTransform
      if (appendTransform === undefined)
        return

      const parentIndex = appendTransform.parentIndex
      if (!Number.isInteger(parentIndex)
        || parentIndex < 0
        || parentIndex >= pmx.bones.length
        || parentIndex >= bones.length) {
        throw new RangeError(
          `GrantSolver: invalid append source index ${parentIndex} for bone ${index}.`,
        )
      }

      const flags = bone.flag
      const affectRotation = (flags & PmxObject.Bone.Flag.HasAppendRotate) !== 0
      const affectPosition = (flags & PmxObject.Bone.Flag.HasAppendMove) !== 0
      if (!affectRotation && !affectPosition)
        return

      const entry: GrantEntry = {
        affectPosition,
        affectRotation,
        appendPosition: new Vector3(),
        appendRotation: new Quaternion(),
        index,
        isLocal: (flags & PmxObject.Bone.Flag.LocalAppendTransform) !== 0,
        parentIndex,
        processed: false,
        ratio: appendTransform.ratio,
        transformOrder: bone.transformOrder,
      }

      this.entries.push(entry)
      this.entriesByIndex[index] = entry
    })

    // Array#sort is stable in the supported ES2019 runtime. The explicit
    // index tie-breaker documents and enforces PMX's file-order rule too.
    this.entries.sort((a, b) => a.transformOrder - b.transformOrder || a.index - b.index)
  }

  /** Restores unchanged output and captures the input for both physics stages. */
  public beginFrame() {
    const bones = this.mesh.skeleton.bones
    for (const [index, pose] of this.appliedPoses) {
      const bone = bones[index]
      if (bone.position.equals(pose.outputPosition))
        bone.position.copy(pose.basePosition)
      if (bone.quaternion.equals(pose.outputRotation))
        bone.quaternion.copy(pose.baseRotation)
    }
    this.reset()
    for (const entry of this.entries) {
      const bone = bones[entry.index]
      this.appliedPoses.set(entry.index, {
        basePosition: bone.position.clone(),
        baseRotation: bone.quaternion.clone(),
        outputPosition: bone.position.clone(),
        outputRotation: bone.quaternion.clone(),
      })
    }
  }

  /** Records the final output after all bone transforms and physics have run. */
  public endFrame() {
    const bones = this.mesh.skeleton.bones
    for (const [index, pose] of this.appliedPoses) {
      pose.outputPosition.copy(bones[index].position)
      pose.outputRotation.copy(bones[index].quaternion)
    }
  }

  /** Discards frame state when an explicit animation pose replaces the output. */
  public reset() {
    this.appliedPoses.clear()
    for (const entry of this.entries) {
      entry.appendPosition.set(0, 0, 0)
      entry.appendRotation.identity()
      entry.processed = false
    }
  }

  /** Applies all append transforms once to the current animated/IK pose. */
  public update() {
    this.beginFrame()
    this.mesh.updateMatrixWorld(true)
    for (const entry of this.entries)
      this.updateBone(entry.index)
    this.mesh.updateMatrixWorld(true)
    this.endFrame()
    return this
  }

  /** Applies one append transform before the IK attached to that bone. */
  public updateBone(boneIndex: number) {
    const entry = this.entriesByIndex[boneIndex]
    if (entry === undefined)
      return

    const bones = this.mesh.skeleton.bones
    const bone = bones[entry.index]
    const positionOffset = bone.position.clone().sub(this.restPositions[entry.index])
    const rotation = bone.quaternion.clone()

    if (entry.affectRotation) {
      const sourceRotation = this.getSourceRotation(entry, bones)
      this.appendQuaternion.copy(this.identityQuaternion).slerp(sourceRotation, entry.ratio)
      rotation.multiply(this.appendQuaternion)
      entry.appendRotation.copy(rotation)
    }

    if (entry.affectPosition) {
      const sourcePosition = this.getSourcePosition(entry, bones)
      positionOffset.addScaledVector(sourcePosition, entry.ratio)
      entry.appendPosition.copy(positionOffset)
    }

    bone.quaternion.copy(rotation)
    bone.position.copy(this.restPositions[entry.index]).add(positionOffset)
    bone.updateMatrixWorld(true)

    entry.processed = true
  }

  private getSourcePosition(
    entry: GrantEntry,
    bones: Bone[],
  ) {
    const sourceEntry = this.entriesByIndex[entry.parentIndex]

    if (!entry.isLocal) {
      if (sourceEntry?.affectPosition && !sourceEntry.processed)
        return sourceEntry.appendPosition

      return this.worldPosition.copy(bones[entry.parentIndex].position).sub(this.restPositions[entry.parentIndex])
    }

    const sourceBone = bones[entry.parentIndex]
    const inverseBindMatrix = this.mesh.skeleton.boneInverses[entry.parentIndex]

    this.skinMatrix.copy(sourceBone.matrixWorld).multiply(inverseBindMatrix)
    return this.worldPosition.setFromMatrixPosition(this.skinMatrix)
  }

  private getSourceRotation(
    entry: GrantEntry,
    bones: Bone[],
  ) {
    const sourceEntry = this.entriesByIndex[entry.parentIndex]

    if (!entry.isLocal) {
      if (sourceEntry?.affectRotation && !sourceEntry.processed) {
        return this.sourceRotation
          .copy(sourceEntry.appendRotation)
          .premultiply(this.ikRotations[entry.parentIndex])
      }

      return bones[entry.parentIndex].quaternion
    }

    const sourceBone = bones[entry.parentIndex]
    sourceBone.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale)
    return this.worldQuaternion
  }
}
