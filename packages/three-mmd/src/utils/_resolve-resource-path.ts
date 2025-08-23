import { LoaderUtils } from 'three'

export const resolveResourcePath = (url: string, resourcePath: string, path: string) =>
  resourcePath !== ''
    ? resourcePath
    // eslint-disable-next-line sonarjs/no-nested-conditional
    : path !== ''
      ? path
      : LoaderUtils.extractUrlBase(url)
