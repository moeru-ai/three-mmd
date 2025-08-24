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
  _matcapCombine: number
  _shininess: number
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

  constructor(parameters?: MaterialParameters) {
    super()

    this.isMMDToonMaterial = true

    this.type = 'MMDToonMaterial'

    this._matcapCombine = AddOperation
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
    Object.defineProperty(this, 'matcapCombine', {
      get() {
        return (this as MMDToonMaterial)._matcapCombine
      },
      set(value: number) {
        (this as MMDToonMaterial)._matcapCombine = value

        switch (value) {
          case MultiplyOperation:
            (this as MMDToonMaterial).defines.MATCAP_BLENDING_MULTIPLY = true
            delete (this as MMDToonMaterial).defines.MATCAP_BLENDING_ADD
            break

          case AddOperation:
          default:
            (this as MMDToonMaterial).defines.MATCAP_BLENDING_ADD = true
            delete (this as MMDToonMaterial).defines.MATCAP_BLENDING_MULTIPLY
            break
        }
      },
    })

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

    // Special path for shininess to handle zero shininess properly
    this._shininess = 30
    Object.defineProperty(this, 'shininess', {

      get() {
        return (this as MMDToonMaterial)._shininess
      },

      set(value: number) {
        (this as MMDToonMaterial)._shininess = value
        ;(this as MMDToonMaterial).uniforms.shininess.value = Math.max((this as MMDToonMaterial)._shininess, 1e-4) // To prevent pow( 0.0, 0.0 )
      },

    })

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
    this.emissiveIntensity = source.emissiveIntensity
    this.normalMapType = source.normalMapType

    this.combine = source.combine

    this.wireframeLinecap = source.wireframeLinecap
    this.wireframeLinejoin = source.wireframeLinejoin

    this.flatShading = source.flatShading

    return this
  }
}
