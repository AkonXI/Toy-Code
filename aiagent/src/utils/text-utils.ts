export function decodeFilename(filename: string): string {
  try {
    return Buffer.from(filename, 'latin1').toString('utf8')
  } catch {
    return filename
  }
}

export function mergeOverlappingChunks(chunks: { pageContent: string }[]): string {
  if (chunks.length === 0) return ''
  if (chunks.length === 1) return chunks[0].pageContent

  const MAX_OVERLAP = 200
  let result = chunks[0].pageContent

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i].pageContent
    const overlapLen = Math.min(MAX_OVERLAP, result.length, next.length)
    let merged = false

    for (let len = overlapLen; len > 0; len--) {
      if (result.endsWith(next.substring(0, len))) {
        result += next.substring(len)
        merged = true
        break
      }
    }

    if (!merged) {
      result += '\n\n' + next
    }
  }

  return result
}
