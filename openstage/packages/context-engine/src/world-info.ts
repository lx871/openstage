import type { KnowledgeEntry } from '@openstage/contracts'
import { hashString } from '@openstage/contracts'

export interface WIState {
  turns: number
  entries: Map<string, { last: number; turn: number }>
  used: Set<string>
}

export interface WIMatchOptions {
  turn: number
  state: WIState
  random?: () => number
  weightedGroup: Record<string, number>
}

export function createWIState(): WIState {
  return { turns: 0, entries: new Map(), used: new Set() }
}

export interface WIActivationResult {
  entry: KnowledgeEntry
  matchedKeys: string[]
  score: number
  skipped: boolean
  reason?: string
}

/**
 * Legacy ST selective/selectiveLogic → key combinator.
 * - selective=false | selectiveLogic=0 → OR（默认：任一主键命中）
 * - selectiveLogic=1 → AND_ANY（主键任一组命中即可，等价 OR 的宽松化）
 * - selectiveLogic=2 → NOT_ALL（所有主键都被排除则忽略）
 * - selectiveLogic=3 → AND（全部主键须命中）
 */
function resolveSelectiveMode(entry: KnowledgeEntry): 'OR' | 'AND' | 'AND_ANY' | 'NOT' {
  const raw = (entry.unknownFields?.['selectiveLogic'] ?? entry.unknownFields?.['selective_logic']) as number | undefined
  const selective = entry.unknownFields?.['selective'] === true
  if (!selective) return 'OR'
  switch (raw) {
    case 1: return 'AND_ANY'
    case 2: return 'NOT'
    case 3: return 'AND'
    default: return 'OR'
  }
}

function evalSelective(
  entry: KnowledgeEntry,
  strings: string[],
  hit: (keys: string[], texts: string[]) => { hit: Map<string, boolean>; any: boolean; all: boolean },
): { ok: boolean; matchedKeys: string[] } {
  const kw = entry.activation.keyword
  const primary = kw.primary.filter((k) => k.length > 0)
  const secondary = kw.secondary.filter((k) => k.length > 0)
  if (primary.length === 0 && secondary.length === 0) return { ok: true, matchedKeys: ['*'] }

  const p = hit(primary, strings)
  const s = hit(secondary, strings)
  const matchedKeys = [...p.hit.keys(), ...s.hit.keys()]

  switch (resolveSelectiveMode(entry)) {
    case 'OR':
      return { ok: primary.length === 0 ? s.any : p.any || s.any, matchedKeys }
    case 'AND':
      return { ok: primary.length > 0 ? p.all && (secondary.length === 0 || s.any) : s.all, matchedKeys }
    case 'AND_ANY':
      return { ok: p.any || s.any, matchedKeys }
    case 'NOT':
      return { ok: !p.any && !s.any, matchedKeys: [] }
  }
}

export interface WIEntryScan {
  matched: boolean
  matchedKeys: string[]
  scannedLines: number
}

export function scanEntry(
  entry: KnowledgeEntry,
  strings: string[],
  opts: { turn: number; state: WIState; random?: () => number; weightedGroup: Record<string, number> },
): WIActivationResult {
  const kw = entry.activation.keyword
  const act = entry.activation
  const primary = kw.primary.filter((k) => k.length > 0)

  const hit = (keys: string[], texts: string[]): { hit: Map<string, boolean>; any: boolean; all: boolean } => {
    const found = new Map<string, boolean>()
    for (const k of keys) {
      if (texts.some((t) => matchKey(t, k, kw))) found.set(k, true)
    }
    return { hit: found, any: found.size > 0, all: keys.length > 0 && found.size === keys.length }
  }

  const selective = evalSelective(entry, strings, hit)

  if (!selective.ok) {
    return { entry, matchedKeys: [], score: 0, skipped: true, reason: `selective unsat (${entry.title ?? entry.uid ?? entry.id})` }
  }

  const rand = opts.random ?? Math.random
  if (act.time.probability < 1 && rand() > act.time.probability) {
    return { entry, matchedKeys: selective.matchedKeys, score: 0, skipped: true, reason: 'probability drop' }
  }

  let effKeys = selective.matchedKeys
  if (primary.length === 0 && selective.matchedKeys.length === 0) {
    effKeys = ['*']
  }

  let score = scanDepthScore(opts.turn)

  // Group weighting: if two entries in same group both match, higher weight
  // wins; lower returns skipped.
  const g = act.group
  if (g && g.weight >= 0) {
    const wg = opts.weightedGroup
    const w = wg[g.key] ?? 0
    if (w > g.weight) {
      return { entry, matchedKeys: effKeys, score, skipped: true, reason: `group weight ${g.weight} < ${w}` }
    }
  }

  const last = opts.state.entries.get(entry.id)
  if (act.time.sticky && last && opts.turn - last.turn === 0) {
    // already activated this turn → keep in window
  }

  opts.state.entries.set(entry.id, { last: opts.turn, turn: opts.turn })
  if (!opts.state.used.has(entry.id)) opts.state.used.add(entry.id)

  return { entry, matchedKeys: effKeys, score, skipped: false }
}

function scanDepthScore(turn: number): number {
  return 10000 - Math.min(turn, 10000)
}

const RE_MAX_LEN = 200
const RE_NESTED_QUANT_RE = /(\+|\*|\{[^}]+\})\s*(\+|\*|\{[^}]+\})/

export function matchKey(text: string, key: string, kw: KnowledgeEntry['activation']['keyword']): boolean {
  if (kw.useRegex) {
    if (key.length > RE_MAX_LEN) return false
    if (RE_NESTED_QUANT_RE.test(key)) return false
    try {
      const flags = kw.caseSensitive === false ? 'i' : ''
      const re = new RegExp(key, flags)
      const ok = re.test(text.slice(0, 8000))
      return ok
    } catch {
      return false
    }
  }
  const caseSensitive = kw.caseSensitive === 'exact' || kw.caseSensitive === 'strict'
  if (caseSensitive) {
    if (!text.includes(key)) return false
  } else if (!text.toLowerCase().includes(key.toLowerCase())) {
    return false
  }
  if (!kw.wholeWord) return true
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, caseSensitive ? '' : 'i')
  return re.test(text)
}

export function rankEntries(entries: KnowledgeEntry[], strings: string[], opts: { turn: number; state: WIState; random?: () => number; weightedGroup: Record<string, number> }): WIActivationResult[] {
  const results = entries.map((e) => scanEntry(e, strings, opts)).filter((r) => !r.skipped)
  results.sort((a, b) => (b.entry.activation.injection.order - a.entry.activation.injection.order) || (b.score - a.score))
  return results
}

export function deriveWeightedGroup(entries: KnowledgeEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  const groups = new Map<string, KnowledgeEntry[]>()
  for (const e of entries) {
    const k = e.activation.group?.key
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }
  for (const [key, list] of groups) {
    out[key] = Math.max(...list.map((e) => e.activation.group?.weight ?? 0))
  }
  return out
}

export function hashCode(s: string): number {
  return hashString(s)
}