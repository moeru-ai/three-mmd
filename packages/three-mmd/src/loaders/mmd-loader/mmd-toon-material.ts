import type { Material, MaterialParameters } from 'three'

import { AddOperation, MultiplyOperation, ShaderMaterial, TangentSpaceNormalMap, UniformsUtils } from 'three'

import { MMDToonShader } from '../../shaders/mmd-toon-shader'

export class MMDToonMaterial extends ShaderMaterial {
  isMMDToonMaterial: boolean
  type: string

  constructor(parameters: MaterialParameters) {
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
        return this._matcapCombine
      },
      set(value) {
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
          return this.uniforms[propertyName].value
        },

        set(value) {
          this.uniforms[propertyName].value = value
        },

      })
    }

    // Special path for shininess to handle zero shininess properly
    this._shininess = 30
    Object.defineProperty(this, 'shininess', {

      get() {
        return this._shininess
      },

      set(value) {
        this._shininess = value
        this.uniforms.shininess.value = Math.max(this._shininess, 1e-4) // To prevent pow( 0.0, 0.0 )
      },

    })

    Object.defineProperty(
      this,
      'color',
      Object.getOwnPropertyDescriptor(this, 'diffuse'),
    )

    this.setValues(parameters)
  }

  copy(source: Material) {
    super.copy(source)

    this.matcapCombine = source.matcapCombine
    this.emissiveIntensity = source.emissiveIntensity
    this.normalMapType = source.normalMapType

    this.combine = source.combine

    this.wireframeLinecap = source.wireframeLinecap
    this.wireframeLinejoin = source.wireframeLinejoin

    this.flatShading = source.flatShading

    return this
  }
}
