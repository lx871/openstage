import type { UnknownRecord } from '@openstage/contracts'
import type { CardVersion, RawCard } from './types.js'
import { objOf } from '@openstage/storage'

export function detectVersion(raw: UnknownRecord): CardVersion {
  const spec = raw['spec']
  if (typeof spec === 'string') {
    if (spec === 'chara_card_v3') return 'v3'
    if (spec === 'chara_card_v2') return 'v2'
    if (spec === 'chara_card_v1') return 'v1'
  }
  if ('data' in raw && typeof raw['data'] === 'object' && raw['data'] !== null) {
    const data = objOf(raw['data'])
    if ('name' in data && 'description' in data) return 'v2'
  }
  if ('name' in raw && 'description' in raw && 'first_mes' in raw) return 'v2'
  if ('name' in raw && 'description' in raw) return 'v1'
  return 'unknown'
}

export function normalizeRaw(parsed: unknown): RawCard {
  const warnings: string[] = []
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { version: 'unknown', data: {}, raw: {}, warnings: ['invalid JSON: not an object'] }
  }
  const raw = parsed as UnknownRecord
  const version = detectVersion(raw)
  let data: UnknownRecord
  if (version === 'v2' || version === 'v3') {
    if ('data' in raw && typeof raw['data'] === 'object' && raw['data'] !== null) {
      data = objOf(raw['data'])
    } else {
      data = raw
    }
  } else {
    data = raw
  }
  if (version === 'unknown') warnings.push('unknown card version, attempting best-effort import')
  return {
    version,
    spec: typeof raw['spec'] === 'string' ? raw['spec'] : undefined,
    spec_version: typeof raw['spec_version'] === 'string' ? raw['spec_version'] : undefined,
    data,
    raw,
    warnings,
  }
}
