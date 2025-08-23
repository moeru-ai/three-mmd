export const extractModelExtension = (buffer: ArrayBuffer) => {
  const decoder = new TextDecoder('utf-8')
  const bytes = new Uint8Array(buffer, 0, 3)
  return decoder.decode(bytes).toLowerCase()
}
