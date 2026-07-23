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
  ratio: number
  transformOrder: number
}

/**
 * Solver for Grant (Fuyo in Japanese. I just google translated because
 * Fuyo may be MMD specific term and may not be common word in 3D CG terms.)
 * Grant propagates a bone's transform to other bones transforms even if
 * they are not children.
 *
 * The append-transform calculation is adapted from babylon-mmd's
 * AppendTransformSolver at commit 2ee0cee. Babylon runtime state is kept
 * here as Three.js pose snapshots and per-bone append results instead of
 * leaking Babylon runtime bones or math types.
 */
export class GrantSolver {
  public readonly mesh: SkinnedMesh

  private readonly appendQuaternion = new Quaternion()
  private readonly appliedPoses = new Map<number, AppliedPose>()
  private readonly entries: GrantEntry[]
  private readonly entriesByIndex: Array<GrantEntry | undefined>

  private readonly identityQuaternion = new Quaternion()
  private readonly restPositions: Vector3[]
  private readonly skinMatrix = new Matrix4()
  private readonly worldPosition = new Vector3()
  private readonly worldQuaternion = new Quaternion()
  private readonly worldScale = new Vector3()

  constructor(mesh: SkinnedMesh, pmx: PmxObject) {
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

  /**
   * Applies all append transforms once to the current animated/IK pose.
   *
   * Callers that use AnimationMixer should restore the animated pose before
   * the mixer runs, as MMD.beforeUpdate() already does.
   */
  public update() {
    const bones = this.mesh.skeleton.bones

    // GrantSolver is normally called after MMD restores the mixer pose. Also
    // make a direct second update harmless when no external animation changed
    // the affected bones in between calls.
    for (const entry of this.entries) {
      const previous = this.appliedPoses.get(entry.index)
      const bone = bones[entry.index]
      if (previous === undefined
        || !bone.position.equals(previous.outputPosition)
        || !bone.quaternion.equals(previous.outputRotation)) {
        continue
      }

      bone.position.copy(previous.basePosition)
      bone.quaternion.copy(previous.baseRotation)
    }

    const basePositions = bones.map(bone => bone.position.clone())
    const baseRotations = bones.map(bone => bone.quaternion.clone())
    const basePositionOffsets = basePositions.map((position, index) =>
      position.clone().sub(this.restPositions[index]),
    )

    for (const entry of this.entries) {
      entry.appendPosition.set(0, 0, 0)
      entry.appendRotation.copy(this.identityQuaternion)
    }

    this.mesh.updateMatrixWorld(true)

    for (const entry of this.entries) {
      const bone = bones[entry.index]
      const positionOffset = basePositionOffsets[entry.index].clone()
      const rotation = baseRotations[entry.index].clone()

      if (entry.affectRotation) {
        const sourceRotation = this.getSourceRotation(entry, bones, baseRotations)
        this.appendQuaternion.copy(this.identityQuaternion).slerp(sourceRotation, entry.ratio)
        rotation.multiply(this.appendQuaternion)
        entry.appendRotation.copy(rotation)
      }

      if (entry.affectPosition) {
        const sourcePosition = this.getSourcePosition(entry, bones, basePositionOffsets)
        positionOffset.addScaledVector(sourcePosition, entry.ratio)
        entry.appendPosition.copy(positionOffset)
      }

      bone.quaternion.copy(rotation)
      bone.position.copy(this.restPositions[entry.index]).add(positionOffset)
      bone.updateMatrixWorld(true)

      this.appliedPoses.set(entry.index, {
        basePosition: basePositions[entry.index].clone(),
        baseRotation: baseRotations[entry.index].clone(),
        outputPosition: bone.position.clone(),
        outputRotation: bone.quaternion.clone(),
      })
    }

    this.mesh.updateMatrixWorld(true)
    return this
  }

  private getSourcePosition(
    entry: GrantEntry,
    bones: Bone[],
    basePositionOffsets: Vector3[],
  ) {
    const sourceEntry = this.entriesByIndex[entry.parentIndex]

    if (!entry.isLocal) {
      if (sourceEntry?.affectPosition)
        return sourceEntry.appendPosition

      return basePositionOffsets[entry.parentIndex]
    }

    const sourceBone = bones[entry.parentIndex]
    const inverseBindMatrix = this.mesh.skeleton.boneInverses[entry.parentIndex]

    this.skinMatrix.copy(sourceBone.matrixWorld).multiply(inverseBindMatrix)
    return this.worldPosition.setFromMatrixPosition(this.skinMatrix)
  }

  private getSourceRotation(
    entry: GrantEntry,
    bones: Bone[],
    baseRotations: Quaternion[],
  ) {
    const sourceEntry = this.entriesByIndex[entry.parentIndex]

    if (!entry.isLocal) {
      if (sourceEntry?.affectRotation)
        return sourceEntry.appendRotation

      return baseRotations[entry.parentIndex]
    }

    const sourceBone = bones[entry.parentIndex]
    sourceBone.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale)
    return this.worldQuaternion
  }
}
