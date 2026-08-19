export type IsoDate = string

export type Id = string

export interface TokenUsage {
  input: number
  output: number
  reasoning?: number
  cachedInput?: number
}

export interface CostBreakdown {
  currency: string
  tokens: TokenUsage
  inputPerM?: number
  outputPerM?: number
  cacheReadPerM?: number
  cacheWritePerM?: number
  total: number
}

export type UnknownRecord = Record<string, unknown>

export interface SourceRef {
  kind: 'character' | 'persona' | 'world-info' | 'memory' | 'chat-history' | 'recipe' | 'preset' | 'generated'
  id?: Id
  name?: string
}

export function uuid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] ?? 0) & 0x0f | 0x40
  bytes[8] = (bytes[8] ?? 0) & 0x3f | 0x80
  const hex = Array.from(bytes, (b) => (b ?? 0).toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}