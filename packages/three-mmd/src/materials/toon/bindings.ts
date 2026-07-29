/* eslint-disable ts/unbound-method */

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

const installOutlineOffset = (material: MeshBasicMaterial, width: number, hasSdefVertices: boolean): ((nextWidth: number) => void) => {
  const outlineWidth = { value: width }
  if (hasSdefVertices)
    installSdefPatch(material)
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
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

/**
 * Makes one object-level custom shadow material safe for meshes with multiple
 * surface materials. WebGLShadowMap copies each group's alpha/displacement
 * state onto the custom material, but keeps its identity. A distinct program
 * cache key per surface forces WebGLRenderer to switch programs and upload
 * that group's material uniforms before drawing it.
 */
const installShadowMaterialVariants = (
  material: MeshDepthMaterial | MeshDistanceMaterial,
): ((surface: MMDToonMaterial) => void) => {
  const baseCacheKey = material.customProgramCacheKey.bind(material)
  let surfaceCacheKey = ''
  material.customProgramCacheKey = () => `${baseCacheKey()}|mmd-shadow-surface:${surfaceCacheKey}`

  return (surface) => {
    surfaceCacheKey = surface.uuid
    material.needsUpdate = true
  }
}

const hasSdefVertices = (mesh: SkinnedMesh): boolean => {
  if (!mesh.geometry.hasAttribute('mmdSdefMask'))
    return false

  const mask = mesh.geometry.getAttribute('mmdSdefMask')
  for (const value of mask.array) {
    if (value !== 0)
      return true
  }
  return false
}

/**
 * Attaches MMD-only render passes to the loaded mesh.
 */
export const installMMDMaterialBindings = (mesh: SkinnedMesh): void => {
  const surfaceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (!surfaceMaterials.every(material => material instanceof MMDToonMaterial))
    return

  const toonMaterials = surfaceMaterials
  const meshHasSdefVertices = hasSdefVertices(mesh)
  for (const material of toonMaterials)
    material.setSdefEnabled(meshHasSdefVertices)

  let updateOutlineMeshVisibility = (): void => {}
  const outlineMaterials = toonMaterials.map((surface) => {
    const { outline } = surface.descriptor
    const outlineEnabled = outline.visible
    const material = new MeshBasicMaterial({
      color: outline.color,
      depthWrite: false,
      opacity: outline.alpha,
      side: BackSide,
      transparent: outline.alpha < 1,
      visible: outlineEnabled && outline.width > 0,
    })
    material.name = `${surface.name}:outline`
    const setOutlineWidth = installOutlineOffset(material, outline.width, meshHasSdefVertices)
    surface.setOutlineStateListener((state) => {
      material.color.copy(state.edgeColor)
      material.opacity = state.edgeAlpha
      material.visible = outlineEnabled && state.edgeWidth > 0
      material.transparent = state.edgeAlpha < 1
      setOutlineWidth(state.edgeWidth)
      updateOutlineMeshVisibility()
    })
    return material
  })

  if (toonMaterials.some(material => material.descriptor.outline.visible)) {
    const outlineMesh = new SkinnedMesh(mesh.geometry, outlineMaterials)
    outlineMesh.name = `${mesh.name}:mmd-outline`
    outlineMesh.bind(mesh.skeleton, mesh.bindMatrix)
    outlineMesh.castShadow = false
    outlineMesh.frustumCulled = mesh.frustumCulled
    updateOutlineMeshVisibility = () => {
      outlineMesh.visible = outlineMaterials.some(material => material.visible)
    }
    updateOutlineMeshVisibility()
    mesh.add(outlineMesh)
  }

  if (!meshHasSdefVertices)
    return

  const depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  const distanceMaterial = new MeshDistanceMaterial()
  installSdefPatch(depthMaterial)
  installSdefPatch(distanceMaterial)
  const setDepthSurface = installShadowMaterialVariants(depthMaterial)
  const setDistanceSurface = installShadowMaterialVariants(distanceMaterial)
  mesh.customDepthMaterial = depthMaterial
  mesh.customDistanceMaterial = distanceMaterial

  const previousOnBeforeShadow = mesh.onBeforeShadow
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, shadowMaterial, group) => {
    previousOnBeforeShadow.call(mesh, renderer, object, camera, shadowCamera, geometry, shadowMaterial, group)

    const surfaceIndex = (group as unknown as null | { materialIndex?: number })?.materialIndex ?? 0
    const surface = toonMaterials.at(surfaceIndex)
    if (surface === undefined)
      return

    if (shadowMaterial === depthMaterial)
      setDepthSurface(surface)
    else if (shadowMaterial === distanceMaterial)
      setDistanceSurface(surface)
  }
}
