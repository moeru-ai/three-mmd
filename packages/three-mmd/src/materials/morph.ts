import type { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import type { Color } from 'three'

import type { MMDMaterialDescriptor, MMDMaterialEvaluatedState } from './types'

import { Vector4 } from 'three'

export const createMMDMaterialEvaluatedState = (descriptor: MMDMaterialDescriptor): MMDMaterialEvaluatedState => ({
  ambient: descriptor.ambient.clone(),
  diffuse: descriptor.diffuse.clone(),
  edgeAlpha: descriptor.outline.alpha,
  edgeColor: descriptor.outline.color.clone(),
  edgeWidth: descriptor.outline.width,
  opacity: descriptor.opacity,
  shininess: descriptor.shininess,
  specular: descriptor.specular.clone(),
  sphereTextureAdditiveColor: new Vector4(0, 0, 0, 0),
  sphereTextureMultiplicativeColor: new Vector4(1, 1, 1, 1),
  textureAdditiveColor: new Vector4(0, 0, 0, 0),
  textureMultiplicativeColor: new Vector4(1, 1, 1, 1),
  toonTextureAdditiveColor: new Vector4(0, 0, 0, 0),
  toonTextureMultiplicativeColor: new Vector4(1, 1, 1, 1),
})

const multiplyColor = (color: Color, value: readonly number[], weight: number): void => {
  color.r += (color.r * value[0] - color.r) * weight
  color.g += (color.g * value[1] - color.g) * weight
  color.b += (color.b * value[2] - color.b) * weight
}

const addColor = (color: Color, value: readonly number[], weight: number): void => {
  color.r += value[0] * weight
  color.g += value[1] * weight
  color.b += value[2] * weight
}

const multiplyVector4 = (vector: Vector4, value: readonly number[], weight: number): void => {
  vector.x += (vector.x * value[0] - vector.x) * weight
  vector.y += (vector.y * value[1] - vector.y) * weight
  vector.z += (vector.z * value[2] - vector.z) * weight
  vector.w += (vector.w * value[3] - vector.w) * weight
}

const addVector4 = (vector: Vector4, value: readonly number[], weight: number): void => {
  vector.x += value[0] * weight
  vector.y += value[1] * weight
  vector.z += value[2] * weight
  vector.w += value[3] * weight
}

/** Applies one PMX material morph element to an evaluated, mutable state. */
export const applyMMDMaterialMorph = (
  state: MMDMaterialEvaluatedState,
  element: PmxObject.Morph.MaterialMorph['elements'][number],
  weight: number,
): void => {
  const multiply = element.type === 0
  if (multiply) {
    multiplyColor(state.diffuse, element.diffuse, weight)
    state.opacity += (state.opacity * element.diffuse[3] - state.opacity) * weight
    multiplyColor(state.specular, element.specular, weight)
    state.shininess += (state.shininess * element.shininess - state.shininess) * weight
    multiplyColor(state.ambient, element.ambient, weight)
    multiplyColor(state.edgeColor, element.edgeColor, weight)
    state.edgeAlpha += (state.edgeAlpha * element.edgeColor[3] - state.edgeAlpha) * weight
    state.edgeWidth += (state.edgeWidth * element.edgeSize - state.edgeWidth) * weight
    multiplyVector4(state.textureMultiplicativeColor, element.textureColor, weight)
    multiplyVector4(state.sphereTextureMultiplicativeColor, element.sphereTextureColor, weight)
    multiplyVector4(state.toonTextureMultiplicativeColor, element.toonTextureColor, weight)
  }
  else {
    addColor(state.diffuse, element.diffuse, weight)
    state.opacity += element.diffuse[3] * weight
    addColor(state.specular, element.specular, weight)
    state.shininess += element.shininess * weight
    addColor(state.ambient, element.ambient, weight)
    addColor(state.edgeColor, element.edgeColor, weight)
    state.edgeAlpha += element.edgeColor[3] * weight
    state.edgeWidth += element.edgeSize * weight
    addVector4(state.textureAdditiveColor, element.textureColor, weight)
    addVector4(state.sphereTextureAdditiveColor, element.sphereTextureColor, weight)
    addVector4(state.toonTextureAdditiveColor, element.toonTextureColor, weight)
  }
}
