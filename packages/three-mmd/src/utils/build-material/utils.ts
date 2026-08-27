import type { BufferGeometry, Texture, TextureLoader, TypedArray } from 'three'

import type { MMDTextureAlphaMode } from '../../materials/core/alpha-policy'
import type { LoadingTexture, TextureContext, TextureLoadOptions } from './types'

import { SharedToonTextures } from 'babylon-mmd/esm/Loader/sharedToonTextures'
import { LoaderUtils, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

import {
  markMMDTextureTransparent,
  resolveMMDTextureAlphaMode,
} from '../../materials/core/alpha-policy'
import { NON_ALPHA_CHANNEL_FORMATS } from './types'

// Check the alpha mode of the image area used by one geometry group.
export const checkImageTransparency = (
  map: LoadingTexture,
  geometry: BufferGeometry,
  groupIndex: number,
  onAlphaMode?: (mode: MMDTextureAlphaMode) => void,
) => {
  map.readyCallbacks!.push((texture: Texture) => {
    // Is there any efficient ways?
    const createImageData = (image: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height

      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)

      return context.getImageData(0, 0, canvas.width, canvas.height)
    }

    const detectImageAlphaMode = (image: ImageData, uvs: TypedArray, indices: TypedArray) => {
      const width = image.width
      const height = image.height
      const data = image.data
      const alphaValues: number[] = []

      /*
        * This method expects
        *   texture.flipY = false
        *   texture.wrapS = RepeatWrapping
        *   texture.wrapT = RepeatWrapping
        * TODO: more precise
        */
      const getAlphaByUv = (image: ImageData, uv: { x: number, y: number }) => {
        const width = image.width
        const height = image.height

        let x = Math.round(uv.x * width) % width
        let y = Math.round(uv.y * height) % height

        if (x < 0)
          x += width
        if (y < 0)
          y += height

        const index = y * width + x

        return image.data[index * 4 + 3]
      }

      if (data.length / (width * height) !== 4)
        return undefined

      for (let i = 0; i < indices.length; i += 3) {
        const uv0 = { x: uvs[indices[i] * 2 + 0], y: uvs[indices[i] * 2 + 1] }
        const uv1 = { x: uvs[indices[i + 1] * 2 + 0], y: uvs[indices[i + 1] * 2 + 1] }
        const uv2 = { x: uvs[indices[i + 2] * 2 + 0], y: uvs[indices[i + 2] * 2 + 1] }

        // Sample a small barycentric grid instead of over-weighting the three
        // vertices. This better approximates Babylon's raster alpha checker,
        // where large opaque interiors should outweigh anti-aliased edges.
        for (let u = 0; u <= 3; u++) {
          for (let v = 0; v <= 3 - u; v++) {
            const w = 3 - u - v
            alphaValues.push(getAlphaByUv(image, {
              x: (uv0.x * u + uv1.x * v + uv2.x * w) / 3,
              y: (uv0.y * u + uv1.y * v + uv2.y * w) / 3,
            }))
          }
        }
      }

      return resolveMMDTextureAlphaMode(alphaValues)
    }

    if ('isCompressedTexture' in texture && texture.isCompressedTexture === true) {
      if (!NON_ALPHA_CHANNEL_FORMATS.includes(texture.format)) {
        // any other way to check transparency of CompressedTexture?
        onAlphaMode?.('blend')
        markMMDTextureTransparent(map)
      }

      return
    }

    const image = texture.image as HTMLImageElement | ImageData
    const imageData: ImageData = ('data' in image)
      ? image
      : createImageData(image)

    const group = geometry.groups[groupIndex]

    const alphaMode = detectImageAlphaMode(
      imageData,
      geometry.attributes.uv.array,
      geometry.index!.array.slice(group.start, group.start + group.count),
    )
    if (alphaMode !== undefined) {
      onAlphaMode?.(alphaMode)
      markMMDTextureTransparent(map, alphaMode)
    }
  })
}

export const getRotatedImage = (image: HTMLImageElement) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  const width = image.width
  const height = image.height

  canvas.width = width
  canvas.height = height

  context.clearRect(0, 0, width, height)
  context.translate(width / 2.0, height / 2.0)
  context.rotate(0.5 * Math.PI) // 90.0 * Math.PI / 180.0
  context.translate(-width / 2.0, -height / 2.0)
  context.drawImage(image, 0, 0)

  return context.getImageData(0, 0, width, height)
}

export const loadTextureResource = (
  filePath: string,
  ctx: TextureContext,
  params: TextureLoadOptions = {},
): LoadingTexture => {
  let fullPath

  if (params.isDefaultToonTexture === true) {
    let index
    try {
      index = Number.parseInt(/toon(\d{2})\.bmp$/.exec(filePath)![1])
    }
    catch {
      console.warn(`MMDLoader: ${filePath} seems like a not right default texture path. Using toon00.bmp instead.`)
      index = 0
    }
    fullPath = SharedToonTextures.Data[index]
  }
  else {
    fullPath = LoaderUtils.resolveURL(filePath, ctx.resourcePath)
  }

  if (ctx.textures[fullPath] != null)
    return ctx.textures[fullPath]

  let loader = ctx.manager.getHandler(fullPath)

  if (loader === null) {
    loader = (filePath.slice(-4).toLowerCase() === '.tga')
      ? ctx.getTGALoader()
      : ctx.textureLoader
  }

  const texture: LoadingTexture = (loader as TextureLoader).load(fullPath, (t: Texture) => {
    if (params.isToonTexture === true) {
      t.image = getRotatedImage(t.image as HTMLImageElement)
      t.magFilter = NearestFilter
      t.minFilter = NearestFilter
      t.generateMipmaps = false
    }

    t.flipY = false
    t.wrapS = RepeatWrapping
    t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace

    for (let i = 0; i < texture.readyCallbacks!.length; i++)
      texture.readyCallbacks![i](texture)

    delete texture.readyCallbacks
  }, ctx.onProgress, ctx.onError)

  texture.readyCallbacks = []

  ctx.textures[fullPath] = texture
  return texture
}
