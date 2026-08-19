import type { UnknownRecord } from '@openstage/contracts'

const PNG_MAX_CHUNK_BYTES = 5 * 1024 * 1024

/** Extract embedded JSON chunk from a PNG file (card data in tEXt chunks named chara / ccv3). */
export function extractPngTextChunk(buffer: Uint8Array): string[] {
  if (buffer.length > 12 * 1024 * 1024) {
    throw Object.assign(new Error(`PNG too large: ${buffer.length} bytes`), { code: 'file_too_large' })
  }
  if (buffer.length < 8) return []
  const chunks: string[] = []
  let p = 8
  while (p + 8 <= buffer.length) {
    const length = readIntBE(buffer, p)
    if (length < 0 || length > PNG_MAX_CHUNK_BYTES) break
    const type = String.fromCharCode(...buffer.slice(p + 4, p + 8))
    const dataStart = p + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > buffer.length) break
    if (type === 'tEXt' && dataEnd <= buffer.length) {
      const text = buffer.slice(dataStart, dataEnd)
      const nullIdx = text.indexOf(0)
      if (nullIdx > 0) {
        const keyword = String.fromCharCode(...text.slice(0, nullIdx))
        if (keyword === 'chara' || keyword === 'ccv3') {
          const value = String.fromCharCode(...text.slice(nullIdx + 1))
          chunks.push(value)
        }
      }
    }
    p = dataEnd + 4
  }
  return chunks
}

export function readIntBE(buf: Uint8Array, offset: number): number {
  if (offset + 4 > buf.length) return 0
  return ((buf[offset]! << 24) >>> 0) + (buf[offset + 1]! << 16) + (buf[offset + 2]! << 8) + buf[offset + 3]!
}

export function parseCharacterJson(raw: string): UnknownRecord {
  const parsed = JSON.parse(raw) as unknown
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as UnknownRecord
    const spec = obj['spec']
    if (typeof spec === 'string' && spec.startsWith('chara_card') && obj['data'] && typeof obj['data'] === 'object') {
      return obj['data'] as UnknownRecord
    }
    return obj
  }
  return {}
}

export function parseStringMap(raw: Record<string, unknown>, keys: string[], def: string): string {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string') return v
  }
  return def
}

export function optionalString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v) return v
  }
  return undefined
}

export function objOf(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function arrOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function asNumber(v: unknown, def = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def
}