/* eslint-disable ts/no-unsafe-argument, ts/no-unsafe-member-access, ts/unbound-method */

import type { Material, Shader } from 'three'

import {
  BackSide,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshDistanceMaterial,
  RGBADepthPacking,
  SkinnedMesh,
} from 'three'

import { MMDToonMaterial } from './mmd-toon-material'
import { installSdefPatch } from './sdef'

const replaceShaderSeam = (source: string, expected: string, replacement: string, label: string): string => {
  if (!source.includes(expected))
    throw new Error(`MMD outline shader patch failed: missing ${label}.`)

  return source.replace(expected, replacement)
}

const installOutlineOffset = (material: MeshBasicMaterial, width: number): ((nextWidth: number) => void) => {
  const outlineWidth = { value: width }
  installSdefPatch(material)
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader: Shader, renderer) => {
    previous?.(shader, renderer)
    shader.uniforms.mmdOutlineWidth = outlineWidth
    shader.vertexShader = replaceShaderSeam(
      shader.vertexShader,
      '#include <common>',
      '#include <common>\nuniform float mmdOutlineWidth;',
      'common',
    )
    shader.vertexShader = replaceShaderSeam(
      shader.vertexShader,
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normalize( objectNormal ) * mmdOutlineWidth;',
      'begin_vertex',
    )
  }
  return (nextWidth) => {
    outlineWidth.value = nextWidth
  }
}

const installShadowSdef = (material: Material): void => {
  material.skinning = true
  installSdefPatch(material)
}

/**
 * Attaches MMD-only render passes to the loaded mesh.
 */
export const installMMDMaterialBindings = (mesh: SkinnedMesh): void => {
  const surfaceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (!surfaceMaterials.every(material => material instanceof MMDToonMaterial))
    return

  const toonMaterials = surfaceMaterials
  const outlineMaterials = toonMaterials.map((surface) => {
    const { outline } = surface.descriptor
    const material = new MeshBasicMaterial({
      color: outline.color,
      depthWrite: false,
      opacity: outline.alpha,
      side: BackSide,
      transparent: outline.alpha < 1,
      visible: outline.visible,
    })
    material.name = `${surface.name}:outline`
    material.skinning = true
    const setOutlineWidth = installOutlineOffset(material, outline.width)
    surface.setOutlineStateListener((state) => {
      material.color.copy(state.edgeColor)
      material.opacity = state.edgeAlpha
      material.visible = state.edgeWidth > 0
      material.transparent = state.edgeAlpha < 1
      setOutlineWidth(state.edgeWidth)
    })
    return material
  })

  if (outlineMaterials.some(material => material.visible)) {
    const outlineMesh = new SkinnedMesh(mesh.geometry, outlineMaterials)
    outlineMesh.name = `${mesh.name}:mmd-outline`
    outlineMesh.bind(mesh.skeleton, mesh.bindMatrix)
    outlineMesh.castShadow = false
    outlineMesh.frustumCulled = mesh.frustumCulled
    mesh.add(outlineMesh)
  }

  const depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  const distanceMaterial = new MeshDistanceMaterial()
  installShadowSdef(depthMaterial)
  installShadowSdef(distanceMaterial)
  mesh.customDepthMaterial = depthMaterial
  mesh.customDistanceMaterial = distanceMaterial
}
