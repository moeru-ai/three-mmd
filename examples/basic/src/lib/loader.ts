export const onProgress = (xhr: ProgressEvent<EventTarget>) => {
  if (!xhr.lengthComputable)
    return

  const percentComplete = xhr.loaded / xhr.total * 100
  // eslint-disable-next-line no-console
  console.log(`${Math.round(percentComplete)}% downloaded`)
}

export const onError = (err: unknown) => console.error(err)
