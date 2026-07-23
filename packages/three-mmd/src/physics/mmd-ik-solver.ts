import type { Bone, SkinnedMesh } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { MMDIKHelper } from './mmd-ik-helper'

interface AppliedPose {
  baseRotation: Quaternion
  outputRotation: Quaternion
}

type EulerRotationOrder = 'XZY' | 'YXZ' | 'ZYX'

interface IKChain {
  bone: Bone
  boneIndex: number
  ikRotation: Quaternion
  localRotation: Quaternion
  maximumAngle: null | Vector3
  minimumAngle: null | Vector3
  rotationOrder: EulerRotationOrder
  solveAxis: SolveAxis
}

interface IKEntry {
  boneIndex: number
  canSkipForPhysics: boolean
  chains: IKChain[]
  enabled: boolean
  ikBone: Bone
  iteration: number
  limitAngle: number
  targetBone: Bone
  transformOrder: number
}

type SolveAxis = 'fixed' | 'none' | 'x' | 'y' | 'z'

/**
 * PMX inverse-kinematics solver for a Three.js skeleton.
 *
 * The constraint calculation is adapted from babylon-mmd's IkSolver at
 * commit 2ee0cee. The input PMX is expected to use the same coordinate
 * system as the supplied mesh.
 */
export class MMDIKSolver {
  public readonly mesh: SkinnedMesh

  private readonly appliedPoses = new Map<number, AppliedPose>()
  private readonly axis = new Vector3()
  private readonly chainIkVector = new Vector3()
  private readonly chainPosition = new Vector3()
  private readonly chainRotationAxis = new Vector3()
  private readonly chainTargetVector = new Vector3()
  private readonly entries: IKEntry[]
  private readonly entriesByBoneIndex = new Map<number, IKEntry>()
  private readonly ikPosition = new Vector3()
  private readonly inverseParentRotation = new Quaternion()
  private readonly invertedLocalRotation = new Quaternion()
  private readonly parentRotation = new Matrix4()
  private readonly pmx: PmxObject
  private readonly rotation = new Quaternion()
  private readonly rotation2 = new Quaternion()
  private readonly rotationMatrix = new Matrix4()
  private readonly targetPosition = new Vector3()
  private readonly xAxis = new Vector3(1, 0, 0)
  private readonly yAxis = new Vector3(0, 1, 0)
  private readonly zAxis = new Vector3(0, 0, 1)

  constructor(mesh: SkinnedMesh, pmx: PmxObject) {
    this.mesh = mesh
    this.pmx = pmx

    const bones = mesh.skeleton.bones
    if (bones.length < pmx.bones.length) {
      throw new RangeError(
        `MMDIKSolver: skeleton has ${bones.length} bones, but PMX contains ${pmx.bones.length}.`,
      )
    }

    const physicsBoneIndices = this.buildPhysicsBoneIndices(pmx)
    const entries: IKEntry[] = []

    pmx.bones.forEach((boneMetadata, boneIndex) => {
      const ik = boneMetadata.ik
      if (ik === undefined)
        return

      this.validateBoneIndex(ik.target, pmx.bones.length, bones.length, `IK target for bone ${boneIndex}`)

      const targetBone = bones[ik.target]
      const chains = ik.links.map((link, chainIndex): IKChain => {
        this.validateBoneIndex(
          link.target,
          pmx.bones.length,
          bones.length,
          `IK link ${chainIndex} for bone ${boneIndex}`,
        )

        const chainBone = bones[link.target]
        const limitation = link.limitation
        let minimumAngle: null | Vector3 = null
        let maximumAngle: null | Vector3 = null
        let rotationOrder: EulerRotationOrder = 'XZY'
        let solveAxis: SolveAxis = 'none'

        if (limitation !== undefined) {
          const minimum = limitation.minimumAngle
          const maximum = limitation.maximumAngle
          minimumAngle = new Vector3(
            Math.min(minimum[0], maximum[0]),
            Math.min(minimum[1], maximum[1]),
            Math.min(minimum[2], maximum[2]),
          )
          maximumAngle = new Vector3(
            Math.max(minimum[0], maximum[0]),
            Math.max(minimum[1], maximum[1]),
            Math.max(minimum[2], maximum[2]),
          )

          const halfPi = Math.PI * 0.5
          if (-halfPi < minimumAngle.x && maximumAngle.x < halfPi)
            rotationOrder = 'YXZ'
          else if (-halfPi < minimumAngle.y && maximumAngle.y < halfPi)
            rotationOrder = 'ZYX'

          if (minimumAngle.x === 0 && maximumAngle.x === 0
            && minimumAngle.y === 0 && maximumAngle.y === 0
            && minimumAngle.z === 0 && maximumAngle.z === 0) {
            solveAxis = 'fixed'
          }
          else if (minimumAngle.y === 0 && maximumAngle.y === 0
            && minimumAngle.z === 0 && maximumAngle.z === 0) {
            solveAxis = 'x'
          }
          else if (minimumAngle.x === 0 && maximumAngle.x === 0
            && minimumAngle.z === 0 && maximumAngle.z === 0) {
            solveAxis = 'y'
          }
          else if (minimumAngle.x === 0 && maximumAngle.x === 0
            && minimumAngle.y === 0 && maximumAngle.y === 0) {
            solveAxis = 'z'
          }
        }

        return {
          bone: chainBone,
          boneIndex: link.target,
          ikRotation: new Quaternion(),
          localRotation: new Quaternion(),
          maximumAngle,
          minimumAngle,
          rotationOrder,
          solveAxis,
        }
      })

      this.warnAboutUnexpectedTopology(targetBone, chains)

      const entry: IKEntry = {
        boneIndex,
        canSkipForPhysics:
          chains.length > 0 && chains.every(chain => physicsBoneIndices.has(chain.boneIndex)),
        chains,
        enabled: true,
        ikBone: bones[boneIndex],
        iteration: Math.min(ik.iteration, 256),
        limitAngle: ik.rotationConstraint,
        targetBone,
        transformOrder: boneMetadata.transformOrder,
      }

      entries.push(entry)
      this.entriesByBoneIndex.set(boneIndex, entry)
    })

    entries.sort(
      (a, b) => a.transformOrder - b.transformOrder || a.boneIndex - b.boneIndex,
    )
    this.entries = entries
  }

  /** Creates a helper that visualizes every PMX IK chain. */
  public createHelper(sphereSize = 0.25) {
    return new MMDIKHelper(this.mesh, this.pmx, sphereSize)
  }

  /** Returns whether the IK definition attached to a PMX bone is enabled. */
  public isEnabled(ikBoneIndex: number): boolean {
    return this.getEntry(ikBoneIndex).enabled
  }

  /** Enables or disables the IK definition attached to a PMX bone. */
  public setEnabled(ikBoneIndex: number, enabled: boolean) {
    this.getEntry(ikBoneIndex).enabled = enabled
    return this
  }

  /**
   * Solves every enabled PMX IK definition against the current bone pose.
   *
   * `delta` is reserved for parity with the model update lifecycle. The
   * current CCD calculation is frame-rate independent.
   *
   * @param delta Elapsed time in seconds.
   * @param physicsAffectsIK Whether PMX rigid-body-controlled chains may be skipped.
   */
  // eslint-disable-next-line unused-imports/no-unused-vars -- Reserved for the frame lifecycle API.
  public update(delta = 0, physicsAffectsIK = false) {
    const bones = this.mesh.skeleton.bones

    // Applying IK writes its result into Three.js bones. Restore an unchanged
    // previous result first so a direct repeated update remains idempotent.
    for (const [boneIndex, pose] of this.appliedPoses) {
      const bone = bones[boneIndex]
      if (bone.quaternion.equals(pose.outputRotation))
        bone.quaternion.copy(pose.baseRotation)
    }

    const baseRotations = new Map<number, Quaternion>()
    for (const entry of this.entries) {
      for (const chain of entry.chains) {
        if (!baseRotations.has(chain.boneIndex))
          baseRotations.set(chain.boneIndex, chain.bone.quaternion.clone())
      }
    }

    this.mesh.updateMatrixWorld(true)

    // TODO: Interleave IK with other bone transforms and physics stages in a
    // future staged pose evaluation pipeline.
    for (const entry of this.entries) {
      if (!entry.enabled || (physicsAffectsIK && entry.canSkipForPhysics))
        continue

      this.solve(entry)

      // TODO: Replace full subtree/world refreshes with targeted link-to-
      // effector path updates after profiling demonstrates a need.
      this.mesh.updateMatrixWorld(true)
    }

    this.appliedPoses.clear()
    for (const [boneIndex, baseRotation] of baseRotations) {
      this.appliedPoses.set(boneIndex, {
        baseRotation,
        outputRotation: bones[boneIndex].quaternion.clone(),
      })
    }

    return this
  }

  private buildPhysicsBoneIndices(pmx: PmxObject) {
    const physicsBoneIndices = new Set<number>()
    const boneIndicesByName = new Map<string, number>()
    pmx.bones.forEach((bone, index) => boneIndicesByName.set(bone.name, index))

    for (const rigidBody of pmx.rigidBodies) {
      if (rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone)
        continue

      let boneIndex = rigidBody.boneIndex
      if (boneIndex < 0 || pmx.bones.length <= boneIndex)
        boneIndex = boneIndicesByName.get(rigidBody.name) ?? -1

      if (boneIndex >= 0 && boneIndex < pmx.bones.length)
        physicsBoneIndices.add(boneIndex)
    }

    return physicsBoneIndices
  }

  private getEntry(ikBoneIndex: number) {
    const entry = this.entriesByBoneIndex.get(ikBoneIndex)
    if (entry === undefined) {
      throw new RangeError(
        `MMDIKSolver: bone ${ikBoneIndex} does not contain an IK definition.`,
      )
    }
    return entry
  }

  private limitAngle(angle: number, min: number, max: number, useAxis: boolean) {
    if (angle < min) {
      const difference = 2 * min - angle
      return difference <= max && useAxis ? difference : min
    }
    if (angle > max) {
      const difference = 2 * max - angle
      return difference >= min && useAxis ? difference : max
    }
    return angle
  }

  private solve(entry: IKEntry) {
    const chains = entry.chains
    if (chains.length === 0)
      return

    for (const chain of chains) {
      chain.localRotation.copy(chain.bone.quaternion)
      chain.ikRotation.identity()
    }

    const ikPosition = this.ikPosition.setFromMatrixPosition(entry.ikBone.matrixWorld)
    const targetPosition = this.targetPosition.setFromMatrixPosition(entry.targetBone.matrixWorld)
    if (ikPosition.distanceToSquared(targetPosition) < 1e-8)
      return

    const halfIteration = entry.iteration >> 1
    for (let iteration = 0; iteration < entry.iteration; iteration += 1) {
      for (let chainIndex = 0; chainIndex < chains.length; chainIndex += 1) {
        const chain = chains[chainIndex]
        if (chain.solveAxis !== 'fixed') {
          this.solveChain(
            entry,
            chain,
            chainIndex,
            ikPosition,
            targetPosition,
            iteration < halfIteration,
          )
        }
      }

      if (ikPosition.distanceToSquared(targetPosition) < 1e-8)
        break
    }
  }

  private solveChain(
    entry: IKEntry,
    chain: IKChain,
    chainIndex: number,
    ikPosition: Vector3,
    targetPosition: Vector3,
    useAxis: boolean,
  ) {
    const chainBone = chain.bone
    const chainPosition = this.chainPosition.setFromMatrixPosition(chainBone.matrixWorld)
    const chainTargetVector = this.chainTargetVector
      .subVectors(chainPosition, targetPosition)
      .normalize()
    const chainIkVector = this.chainIkVector
      .subVectors(chainPosition, ikPosition)
      .normalize()
    const chainRotationAxis = this.chainRotationAxis
      .crossVectors(chainTargetVector, chainIkVector)

    if (chainRotationAxis.lengthSq() < 1e-8)
      return

    const parent = chainBone.parent
    if (parent !== null)
      this.parentRotation.extractRotation(parent.matrixWorld)
    else
      this.parentRotation.identity()

    if (chain.minimumAngle !== null && useAxis) {
      switch (chain.solveAxis) {
        case 'fixed':
          return
        case 'none':
          this.parentRotation.decompose(
            this.axis,
            this.inverseParentRotation,
            this.chainPosition,
          )
          chainRotationAxis
            .applyQuaternion(this.inverseParentRotation.invert())
            .normalize()
          break
        case 'x': {
          const dot = chainRotationAxis.dot(this.axis.setFromMatrixColumn(this.parentRotation, 0))
          chainRotationAxis.set(dot >= 0 ? 1 : -1, 0, 0)
          break
        }
        case 'y': {
          const dot = chainRotationAxis.dot(this.axis.setFromMatrixColumn(this.parentRotation, 1))
          chainRotationAxis.set(0, dot >= 0 ? 1 : -1, 0)
          break
        }
        case 'z': {
          const dot = chainRotationAxis.dot(this.axis.setFromMatrixColumn(this.parentRotation, 2))
          chainRotationAxis.set(0, 0, dot >= 0 ? 1 : -1)
          break
        }
      }
    }
    else {
      this.parentRotation.decompose(
        this.axis,
        this.inverseParentRotation,
        this.chainPosition,
      )
      chainRotationAxis
        .applyQuaternion(this.inverseParentRotation.invert())
        .normalize()
    }

    const dot = Math.max(-1, Math.min(1, chainTargetVector.dot(chainIkVector)))
    const angle = Math.min(entry.limitAngle * (chainIndex + 1), Math.acos(dot))
    this.rotation.setFromAxisAngle(chainRotationAxis, angle)
    chain.ikRotation.premultiply(this.rotation)

    if (chain.minimumAngle !== null && chain.maximumAngle !== null) {
      this.rotation.copy(chain.ikRotation).multiply(chain.localRotation)
      const matrix = this.rotationMatrix.makeRotationFromQuaternion(this.rotation).elements
      const threshold = 88 * Math.PI / 180
      let rotationX: number
      let rotationY: number
      let rotationZ: number

      switch (chain.rotationOrder) {
        case 'XZY': {
          rotationZ = Math.asin(-matrix[4])
          if (Math.abs(rotationZ) > threshold)
            rotationZ = rotationZ < 0 ? -threshold : threshold

          let inverseCosZ = Math.cos(rotationZ)
          if (inverseCosZ !== 0)
            inverseCosZ = 1 / inverseCosZ

          rotationX = Math.atan2(matrix[6] * inverseCosZ, matrix[5] * inverseCosZ)
          rotationY = Math.atan2(matrix[8] * inverseCosZ, matrix[0] * inverseCosZ)
          rotationX = this.limitAngle(rotationX, chain.minimumAngle.x, chain.maximumAngle.x, useAxis)
          rotationY = this.limitAngle(rotationY, chain.minimumAngle.y, chain.maximumAngle.y, useAxis)
          rotationZ = this.limitAngle(rotationZ, chain.minimumAngle.z, chain.maximumAngle.z, useAxis)

          chain.ikRotation
            .setFromAxisAngle(this.xAxis, rotationX)
            .multiply(this.rotation2.setFromAxisAngle(this.zAxis, rotationZ))
            .multiply(this.rotation2.setFromAxisAngle(this.yAxis, rotationY))
          break
        }
        case 'YXZ': {
          rotationX = Math.asin(-matrix[9])
          if (Math.abs(rotationX) > threshold)
            rotationX = rotationX < 0 ? -threshold : threshold

          let inverseCosX = Math.cos(rotationX)
          if (inverseCosX !== 0)
            inverseCosX = 1 / inverseCosX

          rotationY = Math.atan2(matrix[8] * inverseCosX, matrix[10] * inverseCosX)
          rotationZ = Math.atan2(matrix[1] * inverseCosX, matrix[5] * inverseCosX)
          rotationX = this.limitAngle(rotationX, chain.minimumAngle.x, chain.maximumAngle.x, useAxis)
          rotationY = this.limitAngle(rotationY, chain.minimumAngle.y, chain.maximumAngle.y, useAxis)
          rotationZ = this.limitAngle(rotationZ, chain.minimumAngle.z, chain.maximumAngle.z, useAxis)

          chain.ikRotation
            .setFromAxisAngle(this.yAxis, rotationY)
            .multiply(this.rotation2.setFromAxisAngle(this.xAxis, rotationX))
            .multiply(this.rotation2.setFromAxisAngle(this.zAxis, rotationZ))
          break
        }
        case 'ZYX': {
          rotationY = Math.asin(-matrix[2])
          if (Math.abs(rotationY) > threshold)
            rotationY = rotationY < 0 ? -threshold : threshold

          let inverseCosY = Math.cos(rotationY)
          if (inverseCosY !== 0)
            inverseCosY = 1 / inverseCosY

          rotationX = Math.atan2(matrix[6] * inverseCosY, matrix[10] * inverseCosY)
          rotationZ = Math.atan2(matrix[1] * inverseCosY, matrix[0] * inverseCosY)
          rotationX = this.limitAngle(rotationX, chain.minimumAngle.x, chain.maximumAngle.x, useAxis)
          rotationY = this.limitAngle(rotationY, chain.minimumAngle.y, chain.maximumAngle.y, useAxis)
          rotationZ = this.limitAngle(rotationZ, chain.minimumAngle.z, chain.maximumAngle.z, useAxis)

          chain.ikRotation
            .setFromAxisAngle(this.zAxis, rotationZ)
            .multiply(this.rotation2.setFromAxisAngle(this.yAxis, rotationY))
            .multiply(this.rotation2.setFromAxisAngle(this.xAxis, rotationX))
          break
        }
      }

      chain.ikRotation.multiply(
        this.invertedLocalRotation.copy(chain.localRotation).invert(),
      )
    }

    chainBone.quaternion
      .copy(chain.ikRotation)
      .multiply(chain.localRotation)

    // This deliberately refreshes the whole child subtree for now.
    chainBone.updateMatrixWorld(true)
    targetPosition.setFromMatrixPosition(entry.targetBone.matrixWorld)
  }

  private validateBoneIndex(
    index: number,
    pmxBoneCount: number,
    skeletonBoneCount: number,
    description: string,
  ) {
    if (Number.isInteger(index)
      && index >= 0
      && index < pmxBoneCount
      && index < skeletonBoneCount) {
      return
    }

    throw new RangeError(`MMDIKSolver: invalid ${description} index ${index}.`)
  }

  private warnAboutUnexpectedTopology(targetBone: Bone, chains: IKChain[]) {
    let child: Bone = targetBone
    for (const chain of chains) {
      if (child.parent === chain.bone) {
        child = chain.bone
        continue
      }

      console.warn(
        `MMDIKSolver: bone ${child.name} is not a direct child of IK link ${chain.bone.name}.`,
      )
      child = chain.bone
    }
  }
}
