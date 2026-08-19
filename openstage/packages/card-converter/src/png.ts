export function embedCardInPng(pngBytes: Uint8Array, cardJson: string, keyword = 'chara'): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword)
  const textBytes = new TextEncoder().encode(cardJson)
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length)
  chunkData.set(keywordBytes, 0)
  chunkData[keywordBytes.length] = 0
  chunkData.set(textBytes, keywordBytes.length + 1)
  const chunkType = new TextEncoder().encode('tEXt')
  const chunk = buildChunk(chunkType, chunkData)
  const iendPos = findIEND(pngBytes)
  if (iendPos < 0) throw new Error('PNG IEND not found')
  const out = new Uint8Array(pngBytes.length + chunk.length)
  out.set(pngBytes.subarray(0, iendPos), 0)
  out.set(chunk, iendPos)
  out.set(pngBytes.subarray(iendPos), iendPos + chunk.length)
  return out
}

function buildChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
  const len = data.length
  const chunk = new Uint8Array(4 + 4 + len + 4)
  chunk[0] = (len >>> 24) & 0xff
  chunk[1] = (len >>> 16) & 0xff
  chunk[2] = (len >>> 8) & 0xff
  chunk[3] = len & 0xff
  chunk.set(type, 4)
  chunk.set(data, 8)
  const combined = new Uint8Array(type.length + data.length); combined.set(type, 0); combined.set(data, type.length)
  const crc = crc32(combined)
  chunk[8 + len] = (crc >>> 24) & 0xff
  chunk[8 + len + 1] = (crc >>> 16) & 0xff
  chunk[8 + len + 2] = (crc >>> 8) & 0xff
  chunk[8 + len + 3] = crc & 0xff
  return chunk
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10] as const

function findIEND(buf: Uint8Array): number {
  if (buf.length < 8) return -1
  for (let k = 0; k < 8; k++) if (buf[k] !== PNG_SIG[k]!) return -1
  for (let i = 8; i + 8 <= buf.length; ) {
    const len = ((buf[i]! << 24) >>> 0) + (buf[i + 1]! << 16) + (buf[i + 2]! << 8) + buf[i + 3]!
    if (len > 5 * 1024 * 1024) return -1
    const type = String.fromCharCode(buf[i + 4]!, buf[i + 5]!, buf[i + 6]!, buf[i + 7]!)
    if (type === 'IEND') return i
    const next = i + 12 + len
    if (next <= i || next > buf.length) return -1
    i = next
  }
  return -1
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of data) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}
