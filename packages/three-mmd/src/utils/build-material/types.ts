import type { AnyPixelFormat, LoadingManager, Texture, TextureLoader } from 'three'
import type { TGALoader } from 'three/addons/loaders/TGALoader.js'

import {
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
} from 'three'

export interface LoadingTexture extends Texture {
  readyCallbacks?: Array<(texture: Texture) => void>
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

export interface TextureLoadOptions {
  isDefaultToonTexture?: boolean
  isToonTexture?: boolean
}

export const NON_ALPHA_CHANNEL_FORMATS: readonly AnyPixelFormat[] = [
  RGB_S3TC_DXT1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
]
