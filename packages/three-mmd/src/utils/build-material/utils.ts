import type { BufferGeometry, Texture, TextureLoader, TypedArray } from 'three'

import { SharedToonTextures } from 'babylon-mmd/esm/Loader/sharedToonTextures'
import { LoaderUtils, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

import type { LoadingTexture, MaterialBuilderParameters, TextureContext } from './types'

import { NON_ALPHA_CHANNEL_FORMATS } from './types'

// Check if the partial image area used by the texture is transparent.
export const checkImageTransparency = (map: LoadingTexture, geometry: BufferGeometry, groupIndex: number) => {
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

    const detectImageTransparency = (image: ImageData, uvs: TypedArray, indices: TypedArray) => {
      const width = image.width
      const height = image.height
      const data = image.data
      const threshold = 253

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
        return false

      for (let i = 0; i < indices.length; i += 3) {
        const centerUV = { x: 0.0, y: 0.0 }

        for (let j = 0; j < 3; j++) {
          const index = indices[i * 3 + j]
          const uv = { x: uvs[index * 2 + 0], y: uvs[index * 2 + 1] }

          if (getAlphaByUv(image, uv) < threshold)
            return true

          centerUV.x += uv.x
          centerUV.y += uv.y
        }

        centerUV.x /= 3
        centerUV.y /= 3

        if (getAlphaByUv(image, centerUV) < threshold)
          return true
      }

      return false
    }

    if ('isCompressedTexture' in texture && texture.isCompressedTexture === true) {
      if (NON_ALPHA_CHANNEL_FORMATS.includes(texture.format)) {
        map.transparent = false
      }
      else {
        // any other way to check transparency of CompressedTexture?
        map.transparent = true
      }

      return
    }

    const imageData: ImageData = ('data' in texture.image && (texture.image as { data: unknown }).data != null)
      ? texture.image as ImageData
      : createImageData(texture.image as HTMLImageElement)

    const group = geometry.groups[groupIndex]

    if (detectImageTransparency(
      imageData,
      geometry.attributes.uv.array,
      geometry.index!.array.slice(group.start, group.start + group.count),
    )) {
      map.transparent = true
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
  params: Partial<MaterialBuilderParameters> = {},
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
  }, ctx.onProgress, ctx.onError) as LoadingTexture

  texture.readyCallbacks = []

  ctx.textures[fullPath] = texture
  return texture
}
