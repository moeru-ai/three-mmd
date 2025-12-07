import type { AnyPixelFormat, Color, LoadingManager, MaterialParameters, Texture, TextureLoader } from 'three'
import type { TGALoader } from 'three/addons/loaders/TGALoader.js'

import {
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
} from 'three'

import type { MMDToonMaterial } from '../../materials/mmd-toon-material'

export interface LoadingTexture extends Texture {
  readyCallbacks?: Array<(texture: Texture) => void>
  transparent: boolean
}

export interface MaterialBuilderParameters extends MaterialParameters {
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
      mapFileName?: string
      matcapFileName?: string
    }
    outlineParameters: {
      alpha: number
      color: number[]
      thickness: number
      visible: boolean
    }
  }
}

export interface TextureContext {
  getTGALoader: () => TGALoader
  manager: LoadingManager
  onError?: (event: unknown) => void
  onProgress?: (event: ProgressEvent) => void
  resourcePath: string
  textureLoader: TextureLoader
  textures: Record<string, LoadingTexture>
}

export const NON_ALPHA_CHANNEL_FORMATS: readonly AnyPixelFormat[] = [
  RGB_S3TC_DXT1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
]

export type RenderStyleApplier = (params: MaterialBuilderParameters) => MMDToonMaterial
export type RenderStyleName = 'default' | 'flat'
