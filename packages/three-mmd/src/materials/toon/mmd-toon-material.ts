/* eslint-disable ts/unbound-method */

import type { IUniform, Texture } from 'three'

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
  DstAlphaFactor,
  MeshPhongMaterial,
  OneMinusSrcAlphaFactor,
  REVISION,
  SrcAlphaFactor,
  Vector4,
} from 'three'

import { updateMMDAlpha } from '../alpha'
import { installSdefPatch } from '../sdef'

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

const bind = <T>(get: () => T): IUniform<T> => ({
  get value() {
    return get()
  },
})

/**
 * Three's native Phong material with MMD toon/sphere semantics layered through
 * guarded WebGL shader seams. Parameters follow `MeshPhongMaterial`, plus the
 * MMD-only `ambient`, `toonMap`, `sphereMap` and `sphereBlendMode`.
 */
export class MMDToonMaterial extends MeshPhongMaterial implements MMDMaterial {
  public alphaMorph = false
  public ambient = new Color(0, 0, 0)
  public readonly isMMDMaterial = true as const
  public readonly isMMDToonMaterial = true
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

    this.blending = CustomBlending
    this.blendSrc = SrcAlphaFactor
    this.blendDst = OneMinusSrcAlphaFactor
    this.blendSrcAlpha = SrcAlphaFactor
    this.blendDstAlpha = DstAlphaFactor
    this.emissive.setRGB(0, 0, 0)
    this.defines = { MMD_SPHERE_BLEND_MODE: 0, MMD_USE_SDEF: 1 }

    this.setValues(parameters)
    this.defines.MMD_SPHERE_BLEND_MODE = this.getSphereBlendModeValue()
    this.updateAlpha()

    const uniforms = {
      mmdAmbient: bind(() => this.ambient),
      mmdSphereMap: bind(() => this.sphereMap ?? this.toonMap),
      mmdSphereTextureAdditiveColor: bind(() => this.sphereTextureAdditiveColor),
      mmdSphereTextureMultiplicativeColor: bind(() => this.sphereTextureMultiplicativeColor),
      mmdTextureAdditiveColor: bind(() => this.textureAdditiveColor),
      mmdTextureMultiplicativeColor: bind(() => this.textureMultiplicativeColor),
      mmdToonMap: bind(() => this.toonMap),
      mmdToonTextureAdditiveColor: bind(() => this.toonTextureAdditiveColor),
      mmdToonTextureMultiplicativeColor: bind(() => this.toonTextureMultiplicativeColor),
    }

    installSdefPatch(this)
    const previous = this.onBeforeCompile
    this.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer)
      Object.assign(shader.uniforms, uniforms)
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
    this.updateAlpha()
  }

  public override copy(source: this): this {
    super.copy(source)
    this.defines = { ...source.defines }
    this.needsUpdate = true
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
    this.updateAlpha()
    return this
  }

  public updateAlpha(): void {
    updateMMDAlpha(this)
  }

  private getSphereBlendModeValue(): number {
    if (this.sphereMap === null || this.sphereBlendMode === null)
      return 0

    return this.sphereBlendMode === 'add' ? 2 : 1
  }
}
