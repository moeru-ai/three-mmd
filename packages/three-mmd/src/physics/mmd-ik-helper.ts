import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { SkinnedMesh } from 'three'

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'

interface IKHelperEntry {
  effectorBoneIndex: number
  linkBoneIndices: number[]
  targetBoneIndex: number
  transformOrder: number
}

interface IKVisual {
  effectorMesh: Mesh
  entry: IKHelperEntry
  line: Line<BufferGeometry, LineBasicMaterial>
  linkMeshes: Mesh[]
  positionAttribute: BufferAttribute
  targetMesh: Mesh
}

/** Visualizes the target, effector, links, and chain of every PMX IK solver. */
export class MMDIKHelper extends Object3D {
  public readonly effectorSphereMaterial: MeshBasicMaterial
  public readonly lineMaterial: LineBasicMaterial
  public readonly linkSphereMaterial: MeshBasicMaterial
  public readonly root: SkinnedMesh
  public readonly sphereGeometry: SphereGeometry
  public readonly targetSphereMaterial: MeshBasicMaterial

  private readonly matrixWorldInverse = new Matrix4()
  private readonly position = new Vector3()
  private readonly visuals: IKVisual[] = []

  constructor(mesh: SkinnedMesh, pmx: PmxObject, sphereSize = 0.25) {
    super()

    this.root = mesh
    this.matrix.copy(mesh.matrixWorld)
    this.matrixAutoUpdate = false

    this.sphereGeometry = new SphereGeometry(sphereSize, 16, 8)
    this.targetSphereMaterial = new MeshBasicMaterial({
      color: new Color(0xFF8888),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    this.effectorSphereMaterial = new MeshBasicMaterial({
      color: new Color(0x88FF88),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    this.linkSphereMaterial = new MeshBasicMaterial({
      color: new Color(0x8888FF),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    this.lineMaterial = new LineBasicMaterial({
      color: new Color(0xFF0000),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    const entries: IKHelperEntry[] = []
    pmx.bones.forEach((bone, targetBoneIndex) => {
      if (bone.ik === undefined)
        return

      this.validateBoneIndex(targetBoneIndex, 'target')
      this.validateBoneIndex(bone.ik.target, `effector for target ${targetBoneIndex}`)
      bone.ik.links.forEach((link, linkIndex) =>
        this.validateBoneIndex(
          link.target,
          `link ${linkIndex} for target ${targetBoneIndex}`,
        ),
      )

      entries.push({
        effectorBoneIndex: bone.ik.target,
        linkBoneIndices: bone.ik.links.map(link => link.target),
        targetBoneIndex,
        transformOrder: bone.transformOrder,
      })
    })
    entries.sort(
      (a, b) => a.transformOrder - b.transformOrder || a.targetBoneIndex - b.targetBoneIndex,
    )

    this.initialize(entries)
  }

  /** Frees the GPU resources allocated by this helper. */
  public dispose() {
    this.sphereGeometry.dispose()
    this.targetSphereMaterial.dispose()
    this.effectorSphereMaterial.dispose()
    this.linkSphereMaterial.dispose()
    this.lineMaterial.dispose()

    for (const visual of this.visuals)
      visual.line.geometry.dispose()
  }

  public override updateMatrixWorld(force?: boolean) {
    const mesh = this.root

    if (this.visible) {
      this.matrixWorldInverse.copy(mesh.matrixWorld).invert()

      for (const visual of this.visuals) {
        const { entry } = visual
        const bones = mesh.skeleton.bones

        this.setObjectPosition(visual.targetMesh, bones[entry.targetBoneIndex])
        this.setObjectPosition(visual.effectorMesh, bones[entry.effectorBoneIndex])
        this.writeBonePosition(visual.positionAttribute, 0, bones[entry.targetBoneIndex])
        this.writeBonePosition(visual.positionAttribute, 1, bones[entry.effectorBoneIndex])

        entry.linkBoneIndices.forEach((boneIndex, linkIndex) => {
          this.setObjectPosition(visual.linkMeshes[linkIndex], bones[boneIndex])
          this.writeBonePosition(visual.positionAttribute, linkIndex + 2, bones[boneIndex])
        })

        visual.positionAttribute.needsUpdate = true
      }
    }

    this.matrix.copy(mesh.matrixWorld)
    super.updateMatrixWorld(force)
  }

  private initialize(entries: IKHelperEntry[]) {
    for (const entry of entries) {
      const targetMesh = new Mesh(this.sphereGeometry, this.targetSphereMaterial)
      const effectorMesh = new Mesh(this.sphereGeometry, this.effectorSphereMaterial)
      const linkMeshes = entry.linkBoneIndices.map(
        () => new Mesh(this.sphereGeometry, this.linkSphereMaterial),
      )
      const lineGeometry = new BufferGeometry()
      const positionAttribute = new BufferAttribute(
        new Float32Array((2 + entry.linkBoneIndices.length) * 3),
        3,
      )
      lineGeometry.setAttribute('position', positionAttribute)
      const line = new Line(lineGeometry, this.lineMaterial)
      line.frustumCulled = false

      this.add(targetMesh, effectorMesh, ...linkMeshes, line)
      this.visuals.push({
        effectorMesh,
        entry,
        line,
        linkMeshes,
        positionAttribute,
        targetMesh,
      })
    }
  }

  private setObjectPosition(object: Object3D, bone: Object3D) {
    object.position
      .setFromMatrixPosition(bone.matrixWorld)
      .applyMatrix4(this.matrixWorldInverse)
  }

  private validateBoneIndex(index: number, description: string) {
    if (Number.isInteger(index)
      && index >= 0
      && index < this.root.skeleton.bones.length) {
      return
    }

    throw new RangeError(`MMDIKHelper: invalid ${description} bone index ${index}.`)
  }

  private writeBonePosition(attribute: BufferAttribute, index: number, bone: Object3D) {
    this.position
      .setFromMatrixPosition(bone.matrixWorld)
      .applyMatrix4(this.matrixWorldInverse)
    attribute.setXYZ(index, this.position.x, this.position.y, this.position.z)
  }
}
