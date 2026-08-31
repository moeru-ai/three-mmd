/* eslint-disable ts/unbound-method */

import type { Material, SkinnedMesh } from 'three'

import {
  MeshDepthMaterial,
  MeshDistanceMaterial,
  RGBADepthPacking,
  Texture,
} from 'three'

import { isMMDMaterial } from '../types'
import { installSdefPatch } from './sdef'

/**
 * Makes one object-level custom shadow material safe for meshes with multiple
 * surface materials. WebGLShadowMap copies each group's alpha/displacement
 * state onto the custom material, but keeps its identity. A distinct program
 * cache key per surface forces WebGLRenderer to switch programs and upload
 * that group's material uniforms before drawing it.
 */
const installShadowMaterialVariants = (
  material: MeshDepthMaterial | MeshDistanceMaterial,
): ((surface: Material) => void) => {
  const baseCacheKey = material.customProgramCacheKey.bind(material)
  let surfaceCacheKey = ''
  material.customProgramCacheKey = () => `${baseCacheKey()}|mmd-shadow-surface:${surfaceCacheKey}`

  return (surface) => {
    const map = 'map' in surface && surface.map instanceof Texture ? surface.map : undefined
    surfaceCacheKey = `${surface.uuid}|map:${map?.uuid ?? 'none'}|alpha-test:${String(surface.alphaTest > 0)}|side:${String(surface.side)}`
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
  if (!surfaceMaterials.every(isMMDMaterial))
    return

  const mmdMaterials = surfaceMaterials
  const meshHasSdefVertices = hasSdefVertices(mesh)
  for (const material of mmdMaterials)
    material.setSdefEnabled(meshHasSdefVertices)

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
    const surface = mmdMaterials.at(surfaceIndex)
    if (surface === undefined)
      return

    if (shadowMaterial === depthMaterial)
      setDepthSurface(surface)
    else if (shadowMaterial === distanceMaterial)
      setDistanceSurface(surface)
  }
}
