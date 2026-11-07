/* eslint-disable ts/no-unsafe-argument, ts/no-unsafe-assignment, ts/no-unsafe-call, ts/no-unsafe-member-access, ts/no-unsafe-return, sonarjs/redundant-type-aliases */
// TSL's typings omit most vector swizzles and operators, so nodes are loosely typed in this file.

import type { SkinnedMesh, Texture } from 'three'
import type { LightingModelDirectInput } from 'three/src/nodes/core/LightingModel.js'
import type { NodeBuilder } from 'three/webgpu'

import type {
  MMDMaterial,
  MMDMaterialEvaluatedState,
  MMDMaterialParameters,
  MMDSphereBlendMode,
  MMDTextureAlphaMode,
} from '../types'

import {
  Color,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  Vector4,
} from 'three'
import {
  clamp,
  diffuseColor,
  F_Schlick,
  float,
  Fn,
  materialReference,
  materialSpecularStrength,
  mix,
  normalView,
  positionViewDirection,
  shininess,
  specularColor,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { MeshPhongNodeMaterial, PhongLightingModel } from 'three/webgpu'

import { copyMMDAlpha, updateMMDAlpha } from '../alpha'
import { geometryHasSdef, hasSdef, installSdefShadows, setupSdefPosition } from './sdef'

type N = any

const textureColor = (name: string): N => materialReference(name, 'vec4')
const textureNode = (name: string): N => materialReference(name, 'texture')
const ambient = (): N => materialReference('ambient', 'color')

/** `mix(1, value * multiplicative, a) + (value - 1) * additive.a + additive.rgb`, as in the GLSL material. */
const applyTextureColor = (value: N, name: string): N => {
  const multiplicative = textureColor(`${name}MultiplicativeColor`)
  const additive = textureColor(`${name}AdditiveColor`)
  const mixed = mix(vec3(1), value.mul(multiplicative.rgb), multiplicative.a)
  return clamp(mixed.add(mixed.sub(1).mul(additive.a)), 0, 1).add(additive.rgb)
}

// Blinn-Phong as in Three's PhongLightingModel, which doesn't export it.
const brdfBlinnPhong = Fn(({ lightDirection }: { lightDirection: N }) => {
  const halfDirection = lightDirection.add(positionViewDirection).normalize()
  const dotNH = normalView.dot(halfDirection).clamp()
  const dotVH = positionViewDirection.dot(halfDirection).clamp()

  const F: N = F_Schlick({ dotVH, f0: specularColor, f90: float(1) })
  const D = shininess.mul(0.5).add(1).mul(1 / Math.PI).mul(dotNH.pow(shininess))
  return F.mul(0.25).mul(D)
})

const installedShadowMeshes = new WeakSet<SkinnedMesh>()

class MMDToonLightingModel extends PhongLightingModel {
  public override direct({ lightColor, lightDirection, reflectedLight }: LightingModelDirectInput): void {
    const dotNL: N = normalView.dot(lightDirection as N)
    const ramp = vec2(dotNL.mul(0.5).add(0.5).clamp(), 0)
    const toon = textureNode('toonMap').context({ getUV: () => ramp }).rgb
    const irradiance = applyTextureColor(toon, 'toonTexture').mul(lightColor)

    ;(reflectedLight.directDiffuse as N).addAssign(irradiance.mul(diffuseColor.rgb).mul(1 / Math.PI))
    ;(reflectedLight.directSpecular as N).addAssign(
      irradiance.mul(brdfBlinnPhong({ lightDirection })).mul(materialSpecularStrength),
    )
  }

  public override finish(builder: NodeBuilder): void {
    const material = builder.material as MMDToonNodeMaterial
    const { outgoingLight, reflectedLight } = builder.context as {
      outgoingLight: N
      reflectedLight: Record<'directDiffuse' | 'indirectDiffuse', N>
    }

    // MMD adds ambient as emissive, so it takes part in the sphere blend.
    const lit = outgoingLight.add(ambient().mul(0.2))

    if (material.sphereMap === null || material.sphereBlendMode === null) {
      outgoingLight.assign(lit)
    }
    else {
      const uv = normalView.xy.mul(0.5).add(0.5)
      const sampled = textureNode('sphereMap').context({ getUV: () => uv })
      const sphere = applyTextureColor(sampled.rgb, 'sphereTexture')
        .mul(reflectedLight.directDiffuse.add(reflectedLight.indirectDiffuse))
      outgoingLight.assign(material.sphereBlendMode === 'add' ? lit.add(sphere) : lit.mul(sphere))
    }

    super.finish(builder)
  }
}

/**
 * Node-material counterpart of `MMDToonMaterial` for `WebGPURenderer`: Three's
 * Phong node material with MMD toon/sphere semantics in TSL. Takes the same
 * parameters as `MMDToonMaterial`.
 */
export class MMDToonNodeMaterial extends MeshPhongNodeMaterial implements MMDMaterial {
  public alphaMorph = false
  public ambient = new Color(0, 0, 0)
  public readonly isMMDMaterial = true as const
  public readonly isMMDToonNodeMaterial = true
  public sphereBlendMode: MMDSphereBlendMode | null = null
  public sphereMap: null | Texture = null
  public readonly sphereTextureAdditiveColor = new Vector4(0, 0, 0, 0)

  public readonly sphereTextureMultiplicativeColor = new Vector4(1, 1, 1, 1)
  public readonly textureAdditiveColor = new Vector4(0, 0, 0, 0)
  public textureAlphaMode: MMDTextureAlphaMode | null = null
  public readonly textureMultiplicativeColor = new Vector4(1, 1, 1, 1)
  public toonMap: null | Texture = null
  public readonly toonTextureAdditiveColor = new Vector4(0, 0, 0, 0)
  public readonly toonTextureMultiplicativeColor = new Vector4(1, 1, 1, 1)

  public constructor(parameters: MMDMaterialParameters = {}) {
    super()

    this.blendSrc = SrcAlphaFactor
    this.blendDst = OneMinusSrcAlphaFactor
    this.blending = CustomBlending
    this.blendSrcAlpha = OneFactor
    this.blendDstAlpha = OneMinusSrcAlphaFactor
    this.emissive.setRGB(0, 0, 0)

    this.setValues(parameters)
    this.updateAlpha()
  }

  public applyMMDMaterialState(state: MMDMaterialEvaluatedState): void {
    this.color.copy(state.diffuse)
    this.specular.copy(state.specular)
    this.ambient.copy(state.ambient)
    this.opacity = state.opacity
    this.shininess = state.shininess
    this.textureMultiplicativeColor.copy(state.textureMultiplicativeColor)
    this.textureAdditiveColor.copy(state.textureAdditiveColor)
    this.sphereTextureMultiplicativeColor.copy(state.sphereTextureMultiplicativeColor)
    this.sphereTextureAdditiveColor.copy(state.sphereTextureAdditiveColor)
    this.toonTextureMultiplicativeColor.copy(state.toonTextureMultiplicativeColor)
    this.toonTextureAdditiveColor.copy(state.toonTextureAdditiveColor)
    this.updateAlpha()
  }

  public bindSkinnedMesh(mesh: SkinnedMesh): void {
    if (!geometryHasSdef(mesh.geometry) || installedShadowMeshes.has(mesh))
      return
    installedShadowMeshes.add(mesh)
    installSdefShadows(mesh)
  }

  public override copy(source: this): this {
    super.copy(source)
    this.alphaMorph = source.alphaMorph
    this.ambient.copy(source.ambient)
    this.sphereBlendMode = source.sphereBlendMode
    this.sphereMap = source.sphereMap
    this.textureAlphaMode = source.textureAlphaMode
    this.toonMap = source.toonMap
    this.textureMultiplicativeColor.copy(source.textureMultiplicativeColor)
    this.textureAdditiveColor.copy(source.textureAdditiveColor)
    this.sphereTextureMultiplicativeColor.copy(source.sphereTextureMultiplicativeColor)
    this.sphereTextureAdditiveColor.copy(source.sphereTextureAdditiveColor)
    this.toonTextureMultiplicativeColor.copy(source.toonTextureMultiplicativeColor)
    this.toonTextureAdditiveColor.copy(source.toonTextureAdditiveColor)
    copyMMDAlpha(this, source)
    this.updateAlpha()
    return this
  }

  public override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}|mmd-toon-node|${this.sphereBlendMode ?? 'none'}|${this.sphereMap === null ? 'no-sphere' : 'sphere'}`
  }

  public override setupDiffuseColor(builder: NodeBuilder): void {
    // `map` gets MMD's texture color morphs before it modulates the diffuse color.
    const previous = this.colorNode
    if (previous === null && this.map !== null) {
      const sampled = textureNode('map')
      this.colorNode = vec4(
        (materialReference('color', 'color') as N).mul(applyTextureColor(sampled.rgb, 'texture')),
        sampled.a,
      )
    }

    super.setupDiffuseColor(builder)
    this.colorNode = previous
  }

  public override setupLightingModel(): PhongLightingModel {
    return new MMDToonLightingModel()
  }

  public override setupPosition(builder: NodeBuilder): N {
    return hasSdef(builder) ? setupSdefPosition(this, builder) : super.setupPosition(builder)
  }

  public updateAlpha(): void {
    const wasTransparent = this.transparent
    const hadAlphaTest = this.alphaTest > 0

    updateMMDAlpha(this)

    // Opacity and alpha test are baked into the node graph when it is built,
    // and the texture alpha is only known after the texture has loaded.
    if (this.transparent !== wasTransparent || (this.alphaTest > 0) !== hadAlphaTest)
      this.needsUpdate = true
  }
}
