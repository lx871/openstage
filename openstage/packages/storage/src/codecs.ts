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
    const chunkData = buffer.slice(dataStart, dataEnd)
    if (type === 'tEXt') {
      const nullIdx = chunkData.indexOf(0)
      if (nullIdx > 0) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx))
        if (keyword === 'chara' || keyword === 'ccv3') {
          const raw = new TextDecoder().decode(chunkData.slice(nullIdx + 1)).trim()
          const decoded = tryBase64Json(raw) ?? raw
          chunks.push(decoded)
        }
      }
    } else if (type === 'zTXt' || type === 'iTXt') {
      const extracted = tryDecompressChunk(type, chunkData)
      if (extracted) chunks.push(extracted)
    }
    p = dataEnd + 4
  }
  return chunks
}

function tryDecompressChunk(type: string, data: Uint8Array): string | null {
  const nullIdx = data.indexOf(0)
  if (nullIdx <= 0) return null
  const keyword = new TextDecoder().decode(data.slice(0, nullIdx))
  if (keyword !== 'chara' && keyword !== 'ccv3') return null
  try {
    if (type === 'zTXt') {
      const compressed = data.slice(nullIdx + 2)
      const decompressed = tryInflate(compressed)
      if (decompressed) return new TextDecoder().decode(decompressed)
    } else if (type === 'iTXt') {
      let p = nullIdx + 1
      const compFlag = data[p]; p += 1
      const compMethod = data[p]; p += 1
      const langEnd = data.indexOf(0, p); if (langEnd < 0) return null; p = langEnd + 1
      const keyEnd = data.indexOf(0, p); if (keyEnd < 0) return null; p = keyEnd + 1
      const payload = data.slice(p)
      if (compFlag === 1 && compMethod === 0) {
        const decompressed = tryInflate(payload)
        if (decompressed) return new TextDecoder().decode(decompressed)
      } else if (compFlag === 0) {
        return new TextDecoder().decode(payload)
      }
    }
  } catch {}
  return null
}

import { inflate as pakoInflate } from 'pako'

function tryBase64Json(s: string): string | null {
  const t = s.trim()
  if (t.length < 20 || t.length % 4 !== 0) return null
  if (!/^[A-Za-z0-9+/=]+$/.test(t.slice(0, 200))) return null
  try {
    const bytes = Uint8Array.from(atob(t), (c) => c.charCodeAt(0))
    const text = new TextDecoder().decode(bytes)
    const tt = text.trim()
    if (tt.startsWith('{') || tt.startsWith('[')) return text
  } catch {}
  return null
}

function tryInflate(data: Uint8Array): Uint8Array | null {
  try { return pakoInflate(data) } catch { return null }
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