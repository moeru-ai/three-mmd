import type { Color, MaterialParameters } from 'three'

import {
  AddOperation,
  MultiplyOperation,
  ShaderMaterial,
  TangentSpaceNormalMap,
  UniformsUtils,
} from 'three'

import { MMDToonShader } from '../shaders/mmd-toon-shader'

export class MMDToonMaterial extends ShaderMaterial {
  combine: number
  // TODO: emissive declared in MaterialJSON but not where can be
  // found under ShaderMaterial nor Material, but mentioned as
  // https://github.com/mrdoob/three.js/issues/28336, setting
  // emissive for colored textures was required.
  emissive?: Color
  emissiveIntensity?: number
  flatShading: boolean
  isMMDToonMaterial: boolean
  normalMapType: number
  type: string
  wireframeLinecap: string
  wireframeLinejoin: string

  get matcapCombine(): number {
    return this._matcapCombine
  }

  set matcapCombine(value: number) {
    this._matcapCombine = value

    switch (value) {
      case MultiplyOperation:
        this.defines.MATCAP_BLENDING_MULTIPLY = true
        delete this.defines.MATCAP_BLENDING_ADD
        break

      case AddOperation:
      default:
        this.defines.MATCAP_BLENDING_ADD = true
        delete this.defines.MATCAP_BLENDING_MULTIPLY
        break
    }
  }

  get shininess(): number {
    return this._shininess
  }

  // Special path for shininess to handle zero shininess properly
  set shininess(value: number) {
    this._shininess = value
    this.uniforms.shininess.value = Math.max(this._shininess, 1e-4) // To prevent pow( 0.0, 0.0 )
  }

  private _matcapCombine: number
  private _shininess: number

  constructor(parameters?: MaterialParameters) {
    super()

    this.isMMDToonMaterial = true

    this.type = 'MMDToonMaterial'

    this._matcapCombine = AddOperation
    this._shininess = 30

    this.emissiveIntensity = 1.0
    this.normalMapType = TangentSpaceNormalMap

    this.combine = MultiplyOperation

    this.wireframeLinecap = 'round'
    this.wireframeLinejoin = 'round'

    this.flatShading = false

    this.lights = true

    this.vertexShader = MMDToonShader.vertexShader
    this.fragmentShader = MMDToonShader.fragmentShader

    this.defines = Object.assign({}, MMDToonShader.defines)

    this.uniforms = UniformsUtils.clone(MMDToonShader.uniforms)

    // merged from MeshToon/Phong/MatcapMaterial
    const exposePropertyNames = [
      'specular',
      'opacity',
      'diffuse',

      'map',
      'matcap',
      'gradientMap',

      'lightMap',
      'lightMapIntensity',

      'aoMap',
      'aoMapIntensity',

      'emissive',
      'emissiveMap',

      'bumpMap',
      'bumpScale',

      'normalMap',
      'normalScale',

      'displacemantBias',
      'displacemantMap',
      'displacemantScale',

      'specularMap',

      'alphaMap',

      'reflectivity',
      'refractionRatio',
    ]
    for (const propertyName of exposePropertyNames) {
      Object.defineProperty(this, propertyName, {

        get() {
          // eslint-disable-next-line @masknet/type-prefer-return-type-annotation
          return (this as MMDToonMaterial).uniforms[propertyName].value as number
        },

        set(value: number) {
          (this as MMDToonMaterial).uniforms[propertyName].value = value
        },

      })
    }

    Object.defineProperty(
      this,
      'color',
      Object.getOwnPropertyDescriptor(this, 'diffuse')!,
    )

    this.setValues(parameters)
  }

  copy(source: MMDToonMaterial) {
    super.copy(source)

    this._matcapCombine = source._matcapCombine
    // this.matcapCombine = source.matcapCombine
    this._shininess = source._shininess

    this.emissiveIntensity = source.emissiveIntensity
    this.normalMapType = source.normalMapType

    this.combine = source.combine

    this.wireframeLinecap = source.wireframeLinecap
    this.wireframeLinejoin = source.wireframeLinejoin

    this.flatShading = source.flatShading

    return this
  }
}
