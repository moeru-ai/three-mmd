/* eslint-disable ts/unbound-method */

import type { Color, IUniform, MeshPhongMaterialParameters, Texture } from 'three'

import type {
  MMDMaterialCapabilities,
  MMDMaterialDescriptor,
  MMDMaterialEvaluatedState,
  MMDSphereBlendMode,
} from '../types'

import {
  MeshPhongMaterial,
  REVISION,
  Vector4,
} from 'three'

import {
  applyMMDAlphaPolicy,
  onMMDTextureTransparency,
  resolveMMDAlphaPolicy,
} from '../core/alpha-policy'
import { installSdefPatch } from '../core/sdef'

const capabilities: MMDMaterialCapabilities = {
  alpha: ['opaque', 'cutout', 'mmd-depth-blend'],
  materialMorph: 'binding',
  outline: false,
  renderer: ['webgl-renderer'],
  sdef: 'full',
  sphereTexture: ['multiply', 'add'],
  toon: true,
}

const replaceShaderSeam = (source: string, expected: string, replacement: string, name: string): string => {
  if (!source.includes(expected))
    throw new Error(`MMDToonMaterial shader patch failed: missing ${name} (Three r${REVISION}).`)

  return source.replace(expected, replacement)
}

const fragmentPreamble = /* glsl */`
uniform vec3 mmdAmbient;
uniform sampler2D mmdSphereMap;
uniform sampler2D mmdToonMap;
uniform vec4 mmdTextureMultiplicativeColor;
uniform vec4 mmdTextureAdditiveColor;
uniform vec4 mmdSphereTextureMultiplicativeColor;
uniform vec4 mmdSphereTextureAdditiveColor;
uniform vec4 mmdToonTextureMultiplicativeColor;
uniform vec4 mmdToonTextureAdditiveColor;
uniform float mmdSphereBlendMode;

vec3 mmdApplyTextureColor( vec3 value, vec4 multiplicativeColor, vec4 additiveColor ) {
  value = mix( vec3( 1.0 ), value * multiplicativeColor.rgb, multiplicativeColor.a );
  return clamp( value + ( value - vec3( 1.0 ) ) * additiveColor.a, 0.0, 1.0 ) + additiveColor.rgb;
}
`

const mapFragment = /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  sampledDiffuseColor.rgb = mmdApplyTextureColor( sampledDiffuseColor.rgb, mmdTextureMultiplicativeColor, mmdTextureAdditiveColor );
  diffuseColor *= sampledDiffuseColor;
#endif
`

const phongPars = /* glsl */`
varying vec3 vViewPosition;

struct BlinnPhongMaterial {
  vec3 diffuseColor;
  vec3 specularColor;
  float specularShininess;
  float specularStrength;
};

void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = dot( geometryNormal, directLight.direction );
  vec3 toon = texture2D( mmdToonMap, vec2( clamp( dotNL * 0.5 + 0.5, 0.0, 1.0 ), 0.0 ) ).rgb;
  toon = mmdApplyTextureColor( toon, mmdToonTextureMultiplicativeColor, mmdToonTextureAdditiveColor );
  vec3 irradiance = toon * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}

void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

#define RE_Direct RE_Direct_BlinnPhong
#define RE_IndirectDiffuse RE_IndirectDiffuse_BlinnPhong
`

const phongMaterial = /* glsl */`
BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;
`

const emissiveRadiance = /* glsl */`
vec3 totalEmissiveRadiance = emissive + mmdAmbient * 0.2;
`

const outgoingLight = /* glsl */`
vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

#if MMD_SPHERE_BLEND_MODE > 0
vec2 mmdSphereUv = normal.xy * 0.5 + 0.5;
vec3 mmdSphere = texture2D( mmdSphereMap, mmdSphereUv ).rgb;
mmdSphere = mmdApplyTextureColor( mmdSphere, mmdSphereTextureMultiplicativeColor, mmdSphereTextureAdditiveColor );
mmdSphere *= reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
#if MMD_SPHERE_BLEND_MODE > 1
outgoingLight += mmdSphere;
#else
outgoingLight *= mmdSphere;
#endif
#endif
`

const uniform = <T>(value: T): IUniform<T> => ({ value })

const createPhongParameters = (descriptor: MMDMaterialDescriptor): MeshPhongMaterialParameters => ({
  ...(descriptor.alphaTest === undefined ? {} : { alphaTest: descriptor.alphaTest }),
  ...(descriptor.blendDst === undefined ? {} : { blendDst: descriptor.blendDst }),
  ...(descriptor.blendDstAlpha === undefined ? {} : { blendDstAlpha: descriptor.blendDstAlpha }),
  ...(descriptor.blending === undefined ? {} : { blending: descriptor.blending }),
  ...(descriptor.blendSrc === undefined ? {} : { blendSrc: descriptor.blendSrc }),
  ...(descriptor.blendSrcAlpha === undefined ? {} : { blendSrcAlpha: descriptor.blendSrcAlpha }),
  ...(descriptor.map === undefined ? {} : { map: descriptor.map }),
  ...(descriptor.side === undefined ? {} : { side: descriptor.side }),
  color: descriptor.diffuse,
  fog: descriptor.fog,
  opacity: descriptor.opacity,
  shininess: descriptor.shininess,
  specular: descriptor.specular,
  transparent: descriptor.transparent,
})

/**
 * Three's native Phong material with MMD toon/sphere semantics layered through
 * guarded WebGL shader seams. It intentionally has no ShaderMaterial aliases
 * such as `gradientMap` and `matcap`.
 */
export class MMDToonMaterial extends MeshPhongMaterial {
  public static readonly isMMDMaterial = true as const

  public ambient: Color
  public descriptor: MMDMaterialDescriptor
  public readonly isMMDMaterial = true as const
  public readonly isMMDToonMaterial = true

  public readonly mmdCapabilities = capabilities
  public sphereBlendMode?: MMDSphereBlendMode
  public sphereMap?: Texture
  public readonly sphereTextureAdditiveColor = new Vector4(0, 0, 0, 0)

  public readonly sphereTextureMultiplicativeColor = new Vector4(1, 1, 1, 1)
  public readonly textureAdditiveColor = new Vector4(0, 0, 0, 0)
  public readonly textureMultiplicativeColor = new Vector4(1, 1, 1, 1)
  public toonMap: Texture
  public readonly toonTextureAdditiveColor = new Vector4(0, 0, 0, 0)
  public readonly toonTextureMultiplicativeColor = new Vector4(1, 1, 1, 1)

  private readonly mmdUniforms: Record<string, IUniform>
  private stopTextureTransparencyWatch?: () => void

  public constructor(descriptor: MMDMaterialDescriptor) {
    super(createPhongParameters(descriptor))

    this.descriptor = descriptor
    this.name = descriptor.name
    this.ambient = descriptor.ambient.clone()
    this.sphereBlendMode = descriptor.sphereBlendMode
    this.sphereMap = descriptor.sphereMap
    this.toonMap = descriptor.toonMap
    this.emissive.setRGB(0, 0, 0)
    this.watchDiffuseMap(descriptor.map)
    this.defines = {
      ...this.defines,
      MMD_SPHERE_BLEND_MODE: this.getSphereBlendModeValue(),
      MMD_USE_SDEF: 1,
    }

    this.mmdUniforms = {
      mmdAmbient: uniform(this.ambient),
      mmdSphereBlendMode: uniform(this.getSphereBlendModeValue()),
      mmdSphereMap: uniform(this.sphereMap ?? this.toonMap),
      mmdSphereTextureAdditiveColor: uniform(this.sphereTextureAdditiveColor),
      mmdSphereTextureMultiplicativeColor: uniform(this.sphereTextureMultiplicativeColor),
      mmdTextureAdditiveColor: uniform(this.textureAdditiveColor),
      mmdTextureMultiplicativeColor: uniform(this.textureMultiplicativeColor),
      mmdToonMap: uniform(this.toonMap),
      mmdToonTextureAdditiveColor: uniform(this.toonTextureAdditiveColor),
      mmdToonTextureMultiplicativeColor: uniform(this.toonTextureMultiplicativeColor),
    }

    installSdefPatch(this)
    const previous = this.onBeforeCompile
    this.onBeforeCompile = (shader, renderer) => {
      previous?.(shader, renderer)
      Object.assign(shader.uniforms, this.mmdUniforms)
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <common>', `#include <common>\n${fragmentPreamble}`, 'common')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <map_fragment>', mapFragment, 'map_fragment')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <lights_phong_pars_fragment>', phongPars, 'lights_phong_pars_fragment')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <lights_phong_fragment>', phongMaterial, 'lights_phong_fragment')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, 'vec3 totalEmissiveRadiance = emissive;', emissiveRadiance, 'totalEmissiveRadiance')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;', outgoingLight, 'outgoingLight')
      // MMD materials use their PMX sphere texture for reflections. Unlike
      // MeshPhongMaterial, they must not also inherit scene.environment.
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <lights_fragment_maps>', '', 'lights_fragment_maps')
      shader.fragmentShader = replaceShaderSeam(shader.fragmentShader, '#include <envmap_fragment>', '', 'envmap_fragment')
    }
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
    this.transparent = this.transparent || this.opacity < 1
  }

  public override clone(): this {
    const Constructor = this.constructor as new (descriptor: MMDMaterialDescriptor) => this
    return new Constructor(this.descriptor).copy(this)
  }

  public override copy(source: this): this {
    super.copy(source)
    this.defines = { ...source.defines }
    this.descriptor = source.descriptor
    this.ambient.copy(source.ambient)
    this.sphereBlendMode = source.sphereBlendMode
    this.sphereMap = source.sphereMap
    this.toonMap = source.toonMap
    this.textureMultiplicativeColor.copy(source.textureMultiplicativeColor)
    this.textureAdditiveColor.copy(source.textureAdditiveColor)
    this.sphereTextureMultiplicativeColor.copy(source.sphereTextureMultiplicativeColor)
    this.sphereTextureAdditiveColor.copy(source.sphereTextureAdditiveColor)
    this.toonTextureMultiplicativeColor.copy(source.toonTextureMultiplicativeColor)
    this.toonTextureAdditiveColor.copy(source.toonTextureAdditiveColor)
    this.mmdUniforms.mmdSphereMap.value = this.sphereMap ?? this.toonMap
    this.mmdUniforms.mmdToonMap.value = this.toonMap
    this.mmdUniforms.mmdSphereBlendMode.value = this.getSphereBlendModeValue()
    this.watchDiffuseMap(source.map)
    return this
  }

  public override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}|mmd-toon|${this.sphereBlendMode ?? 'none'}|${this.sphereMap === undefined ? 'no-sphere' : 'sphere'}|sdef:${String(this.defines?.MMD_USE_SDEF ?? 1)}`
  }

  public setMMDAlphaMorphEnabled(enabled: boolean): void {
    if (!(enabled))
      return
    this.transparent = true
    this.depthWrite = true
  }

  public setSdefEnabled(enabled: boolean): void {
    const value = enabled ? 1 : 0
    if (this.defines?.MMD_USE_SDEF === value)
      return

    this.defines = { ...this.defines, MMD_USE_SDEF: value }
    this.needsUpdate = true
  }

  private getSphereBlendModeValue(): number {
    if (this.sphereMap === undefined || this.sphereBlendMode === undefined)
      return 0

    return this.sphereBlendMode === 'add' ? 2 : 1
  }

  private watchDiffuseMap(map: null | Texture | undefined): void {
    this.stopTextureTransparencyWatch?.()
    this.stopTextureTransparencyWatch = undefined
    if (map === null || map === undefined)
      return

    this.stopTextureTransparencyWatch = onMMDTextureTransparency(map, () => {
      const evaluatedMode = resolveMMDAlphaPolicy({
        alphaTest: this.descriptor.alphaTest,
        mode: 'evaluate',
        opacity: this.opacity,
        textureHasTransparency: true,
      })
      applyMMDAlphaPolicy(
        this,
        evaluatedMode === 'blend' ? 'mmd-depth-blend' : evaluatedMode,
        this.descriptor.alphaTest ?? 0.5,
      )
    })
  }
}
