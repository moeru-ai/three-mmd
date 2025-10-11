import type { BufferGeometry, LoadingManager, Material, MaterialParameters, Texture, TypedArray } from 'three'

import { PmxObject } from 'babylon-mmd/esm/Loader/Parser/pmxObject'
import {
  AddOperation,
  Color,
  CustomBlending,
  DefaultLoadingManager,
  DoubleSide,
  DstAlphaFactor,
  FrontSide,
  MultiplyOperation,
  NearestFilter,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
  SrcAlphaFactor,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { TGALoader } from 'three/addons/loaders/TGALoader.js'

import { MMDToonMaterial } from '../materials/mmd-toon-material'

interface MaterialBuilderParameters extends MaterialParameters {
  diffuse?: Color
  emissive: Color
  fog: boolean
  gradientMap: LoadingTexture
  isDefaultToonTexture: boolean
  isToonTexture: boolean
  map?: LoadingTexture
  matcap: Texture
  matcapCombine: number

  name?: string
  opacity: number
  shininess: number

  specular: Color
  transparent: boolean
  userData: {
    MMD: {
      mapFileName: string
      matcapFileName: string
    }
    outlineParameters: {
      alpha: number
      color: number[]
      thickness: number
      visible: boolean
    }
  }
}

/*
 * base64 encoded default toon textures toon00.bmp - toon10.bmp.
 * We don't need to request external toon image files.
 */
const DEFAULT_TOON_TEXTURES = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAN0lEQVRYR+3WQREAMBACsZ5/bWiiMvgEBTt5cW37hjsBBAgQIECAwFwgyfYPCCBAgAABAgTWAh8aBHZBl14e8wAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVRYR+3WMREAMAwDsYY/yoDI7MLwIiP40+RJklfcCCBAgAABAgTqArfb/QMCCBAgQIAAgbbAB3z/e0F3js2cAAAAAElFTkSuQmCC',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAN0lEQVRYR+3WQREAMBACsZ5/B5ilMvgEBTt5cW37hjsBBAgQIECAwFwgyfYPCCBAgAABAgTWAh81dWyx0gFwKAAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOklEQVRYR+3WoREAMAwDsWb/UQtCy9wxTOQJ/oQ8SXKKGwEECBAgQIBAXeDt7f4BAQQIECBAgEBb4AOz8Hzx7WLY4wAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABPUlEQVRYR+1XwW7CMAy1+f9fZOMysSEOEweEOPRNdm3HbdOyIhAcklPrOs/PLy9RygBALxzcCDQFmgJNgaZAU6Ap0BR4PwX8gsRMVLssMRH5HcpzJEaWL7EVg9F1IHRlyqQohgVr4FGUlUcMJSjcUlDw0zvjeun70cLWmneoyf7NgBTQSniBTQQSuJAZsOnnaczjIMb5hCiuHKxokCrJfVnrctyZL0PkJAJe1HMil4nxeyi3Ypfn1kX51jpPvo/JeCNC4PhVdHdJw2XjBR8brF8PEIhNVn12AgP7uHsTBguBn53MUZCqv7Lp07Pn5k1Ro+uWmUNn7D+M57rtk7aG0Vo73xyF/fbFf0bPJjDXngnGocDTdFhygZjwUQrMNrDcmZlQT50VJ/g/UwNyHpu778+yW+/ksOz/BFo54P4AsUXMfRq7XWsAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACMElEQVRYR+2Xv4pTQRTGf2dubhLdICiii2KnYKHVolhauKWPoGAnNr6BD6CvIVaihYuI2i1ia0BY0MZGRHQXjZj/mSPnnskfNWiWZUlzJ5k7M2cm833nO5Mziej2DWWJRUoCpQKlAntSQCqgw39/iUWAGmh37jrRnVsKlgpiqmkoGVABA7E57fvY+pJDdgKqF6HzFCSADkDq+F6AHABtQ+UMVE5D7zXod7fFNhTEckTbj5XQgHzNN+5tQvc5NG7C6BNkp6D3EmpXHDR+dQAjFLchW3VS9rlw3JBh+B7ys5Cf9z0GW1C/7P32AyBAOAz1q4jGliIH3YPuBnSfQX4OGreTIgEYQb/pBDtPnEQ4CivXYPAWBk13oHrB54yA9QuSn2H4AcKRpEILDt0BUzj+RLR1V5EqjD66NPRBVpLcQwjHoHYJOhsQv6U4mnzmrIXJCFr4LDwm/xBUoboG9XX4cc9VKdYoSA2yk5NQLJaKDUjTBoveG3Z2TElTxwjNK4M3LEZgUdDdruvcXzKBpStgp2NPiWi3ks9ZXxIoFVi+AvHLdc9TqtjL3/aYjpPlrzOcEnK62Szhimdd7xX232zFDTgtxezOu3WNMRLjiKgjtOhHVMd1loynVHvOgjuIIJMaELEqhJAV/RCSLbWTcfPFakFgFlALTRRvx+ok6Hlp/Q+v3fmx90bMyUzaEAhmM3KvHlXTL5DxnbGf/1M8RNNACLL5MNtPxP/mypJAqcDSFfgFhpYqWUzhTEAAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
] as const

const NON_ALPHA_CHANNEL_FORMATS = [
  RGB_S3TC_DXT1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
] as readonly number[]

interface LoadingTexture extends Texture {
  readyCallbacks?: ((texture: Texture) => void)[]
  transparent: boolean
}

class MaterialBuilderB {
  crossOrigin = 'anonymous'
  manager: LoadingManager
  resourcePath?: string
  textureLoader: TextureLoader
  tgaLoader?: TGALoader = undefined

  constructor(manager: LoadingManager) {
    this.manager = manager
    this.textureLoader = new TextureLoader(manager)
  }

  /**
   * @param data - parsed PMX data
   * @param geometry - some properties are depended on geometry
   */
  public build(
    data: PmxObject,
    geometry: BufferGeometry,
    _onProgress?: (event: ProgressEvent) => void,
    _onError?: (event: ErrorEvent) => void,
  ): MMDToonMaterial[] {
    const materials = []

    const textures = {}

    this.textureLoader.setCrossOrigin(this.crossOrigin)

    // materials
    for (let i = 0; i < data.materials.length; i++) {
      const material: PmxObject.Material = data.materials[i]

      // TODO: rewrite this
      // eslint-disable-next-line ts/no-unsafe-assignment
      const params: MaterialBuilderParameters = { userData: { MMD: {} } } as any

      params.name = material.name

      /*
       * Color
       *
       * MMD         MMDToonMaterial
       * ambient  -  emissive * a
       *               (a = 1.0 without map texture or 0.2 with map texture)
       *
       * MMDToonMaterial doesn't have ambient. Set it to emissive instead.
       * It'll be too bright if material has map texture so using coef 0.2.
       */
      params.diffuse = new Color().setRGB(
        material.diffuse[0],
        material.diffuse[1],
        material.diffuse[2],
        SRGBColorSpace,
      )
      params.opacity = material.diffuse[3]
      params.specular = new Color().setRGB(...material.specular, SRGBColorSpace)
      params.shininess = material.shininess
      params.emissive = new Color().setRGB(...material.ambient, SRGBColorSpace)
      params.transparent = params.opacity !== 1.0

      //
      params.fog = true

      // blend
      params.blending = CustomBlending
      params.blendSrc = SrcAlphaFactor
      params.blendDst = OneMinusSrcAlphaFactor
      params.blendSrcAlpha = SrcAlphaFactor
      params.blendDstAlpha = DstAlphaFactor

      // side
      if ((material.flag & PmxObject.Material.Flag.IsDoubleSided) === 1) {
        params.side = DoubleSide
      }
      else {
        params.side = params.opacity === 1.0 ? FrontSide : DoubleSide
      }

      // map
      if (material.textureIndex !== -1) {
        params.map = this.loadTexture(data.textures[material.textureIndex], textures)

        // Since PMX spec don't have standard to list map files except color map and env map,
        // we need to save file name for further mapping, like matching normal map file names after model loaded.
        // ref: https://gist.github.com/felixjones/f8a06bd48f9da9a4539f#texture
        params.userData.MMD.mapFileName = data.textures[material.textureIndex]
      }

      // matcap TODO: support m.envFlag === 3
      if (material.sphereTextureIndex !== -1 && (material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply || material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Add)) {
        params.matcap = this.loadTexture(
          data.textures[material.sphereTextureIndex],
          textures,
        )

        // Same as color map above, keep file name in userData for further usage.
        params.userData.MMD.matcapFileName = data.textures[material.sphereTextureIndex]

        params.matcapCombine = material.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
          ? MultiplyOperation
          : AddOperation
      }

      // gradientMap
      let isDefaultToon, toonFileName

      if (material.isSharedToonTexture) {
        // eslint-disable-next-line sonarjs/no-nested-template-literals
        toonFileName = `toon${(`0${material.toonTextureIndex + 1}`).slice(-2)}.bmp`
        isDefaultToon = true
      }
      else {
        toonFileName = data.textures[material.toonTextureIndex]
        isDefaultToon = false
      }

      params.gradientMap = this.loadTexture(
        toonFileName,
        textures,
        {
          isDefaultToonTexture: isDefaultToon,
          isToonTexture: true,
        },
      )

      // parameters for OutlineEffect
      params.userData.outlineParameters = {
        alpha: material.edgeColor[3],
        color: material.edgeColor.slice(0, 3),
        thickness: material.edgeSize / 300, // TODO: better calculation?
        visible: (material.flag & PmxObject.Material.Flag.EnabledToonEdge) !== 0 && material.edgeSize > 0.0,
      }

      if (params.map !== undefined) {
        if (!params.transparent)
          this.checkImageTransparency(params.map, geometry, i)

        params.emissive.multiplyScalar(0.2)
      }

      materials.push(new MMDToonMaterial(params))
    }

    // set transparent true if alpha morph is defined.
    const checkAlphaMorph = (elements: PmxObject.Morph.MaterialMorph['elements'], materials: Material[]) => {
      for (let i = 0, il = elements.length; i < il; i++) {
        const element = elements[i]

        if (element.index === -1)
          continue

        const material = materials[element.index]

        if (material.opacity !== element.diffuse[3])
          material.transparent = true
      }
    }

    for (let i = 0, il = data.morphs.length; i < il; i++) {
      const morph = data.morphs[i]

      if (morph.type === PmxObject.Morph.Type.GroupMorph) {
        for (let j = 0, jl = morph.indices.length; j < jl; j++) {
          const morph2 = data.morphs[morph.indices[j]]

          if (morph2.type !== PmxObject.Morph.Type.MaterialMorph)
            continue

          checkAlphaMorph(morph2.elements, materials)
        }
      }
      else if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
        checkAlphaMorph(morph.elements, materials)
      }
    }

    return materials
  }

  public setCrossOrigin(crossOrigin: string): this {
    this.crossOrigin = crossOrigin
    return this
  }

  public setResourcePath(resourcePath: string): this {
    this.resourcePath = resourcePath
    return this
  }

  // Check if the partial image area used by the texture is transparent.
  private checkImageTransparency(map: LoadingTexture, geometry: BufferGeometry, groupIndex: number) {
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

  private getRotatedImage(image: HTMLImageElement) {
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

  private getTGALoader(): TGALoader {
    if (this.tgaLoader == null)
      this.tgaLoader = new TGALoader(this.manager)

    return this.tgaLoader
  }

  private isDefaultToonTexture(name: string): boolean {
    if (name.length !== 10)
      return false

    return /toon(?:10|0\d)\.bmp/.test(name)
  }

  private loadTexture(filePath: string, textures: Record<string, LoadingTexture>, params?: { isDefaultToonTexture: boolean, isToonTexture: boolean }, onProgress?: () => void, onError?: () => void): LoadingTexture {
    params = params || {} as MaterialBuilderParameters

    let fullPath

    if (params.isDefaultToonTexture === true) {
      let index

      try {
        index = Number.parseInt(/toon(\d{2})\.bmp$/.exec(filePath)![1])
      }
      catch {
        console.warn(`MMDLoader: ${filePath} seems like a `
          + 'not right default texture path. Using toon00.bmp instead.')

        index = 0
      }

      fullPath = DEFAULT_TOON_TEXTURES[index]
    }
    else {
      fullPath = this.resourcePath + filePath
    }

    if (textures[fullPath] != null)
      return textures[fullPath]

    let loader = this.manager.getHandler(fullPath)

    if (loader === null) {
      loader = (filePath.slice(-4).toLowerCase() === '.tga')
        ? this.getTGALoader()
        : this.textureLoader
    }

    // TODO: FIXME: rewrite this
    // @ts-expect-error magic load
    const texture: LoadingTexture = loader.load(fullPath, (t: Texture) => {
      // MMD toon texture is Axis-Y oriented
      // but Three.js gradient map is Axis-X oriented.
      // So here replaces the toon texture image with the rotated one.
      if (params.isToonTexture === true) {
        t.image = this.getRotatedImage(t.image as HTMLImageElement)

        t.magFilter = NearestFilter
        t.minFilter = NearestFilter
        t.generateMipmaps = false
      }

      t.flipY = false
      t.wrapS = RepeatWrapping
      t.wrapT = RepeatWrapping
      t.colorSpace = SRGBColorSpace

      for (let i = 0; i < texture.readyCallbacks!.length; i++) {
        texture.readyCallbacks![i](texture)
      }

      delete texture.readyCallbacks
    }, onProgress, onError)

    texture.readyCallbacks = []

    textures[fullPath] = texture

    return texture
  }
}

export const buildMaterial = (
  data: PmxObject,
  geometry: BufferGeometry,
  resourcePath: string,
  onProgress?: (event: ProgressEvent) => void,
  onError?: (event: ErrorEvent) => void,
) => {
  return new MaterialBuilderB(DefaultLoadingManager)
    .setResourcePath(resourcePath)
    .build(data, geometry, onProgress, onError)
}
