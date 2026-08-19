import type { Character, KnowledgeEntry, UnknownRecord } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'
import { ContentPart } from './content.js'

const KEYWORDS_DEFAULT = {
  combinator: 'OR' as const,
  caseSensitive: false as const,
  wholeWord: false,
  useRegex: false,
}

export function identityFromV2(card: Record<string, unknown> | undefined | null): Character['identity'] | null {
  if (!card || typeof card !== 'object') return null
  const c = card as Record<string, unknown>
  return {
    name: str(c.name),
    description: str(c.description),
    personality: str(c.personality),
    scenario: str(c.scenario),
    appearance: str(c['appearance']),
    meta: extractUnknown(c),
  }
}

export function presentationFromV2(card: Record<string, unknown> | undefined | null): Character['presentation'] {
  const mesExample = str(card?.['mes_example'] ?? card?.['example_dialogue'])
  const alt = Array.isArray(card?.['alternate_greetings']) ? (card!['alternate_greetings'] as unknown[]) : []
  const alternatives = alt.map((a) => typeof a === 'string' ? a : '').filter(Boolean)
  const guide = {
    exampleMessages: [mesExample].filter(Boolean),
    format: 'plain',
    greetingCandidates: [ContentPart.text(str(card?.['first_mes'] ?? '')), ...alternatives.map((a) => ContentPart.text(a))].filter((g) => g.text().length > 0),
  }
  return { guide, assets: [] }
}

export function behaviorFromV2(card: Record<string, unknown> | undefined | null): Character['behavior'] {
  const behavior: Character['behavior'] = {
    systemOverrides: {},
    toolAuthorization: [],
  }
  if (card && typeof card === 'object') {
    const c = card as Record<string, unknown>
    for (const key of ['system_prompt', 'post_history_instructions']) {
      if (typeof c[key] === 'string' && c[key] as string) behavior.systemOverrides[key] = c[key] as string
    }
  }
  return behavior
}

export function characterFromV2(card: Record<string, unknown> | null | undefined, opts?: { id?: string }): Character {
  const i = identityFromV2(card) ?? { name: '', description: '', personality: '', scenario: '' }
  const p = presentationFromV2(card)
  const b = behaviorFromV2(card)
  const c = card && typeof card === 'object' ? card : {}
  return {
    id: opts?.id ?? uuid(),
    identity: i,
    presentation: p,
    behavior: b,
    knowledgeEntryIds: [],
    importedFrom: c['_importedFrom'] ? str(c['_importedFrom']) : undefined,
    unknownFields: extractUnknown(c),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }
}

export function knowledgeFromV2Entry(idx: number, src: Record<string, unknown> | null | undefined): KnowledgeEntry | null {
  if (!src || typeof src !== 'object') return null
  const e = src as Record<string, unknown>
  const content = str(e.content)
  if (!content) return null
  return {
    id: uuid(),
    type: (e.type && typeof e.type === 'string' ? e.type as KnowledgeEntry['type'] : undefined) ?? 'fact',
    enabled: e.enabled === false ? false : true,
    title: str(e.title ?? e.comment) || undefined,
    uid: str(e.uid),
    content,
    activation: {
      mode: 'keyword',
      keyword: {
        primary: Array.isArray(e.keys) ? e.keys.map(s) : Array.isArray(e.key) ? e.key.map(s) : typeof e.key === 'string' ? [e.key as string] : [],
        secondary: Array.isArray(e.keysecondary) ? e.keysecondary.map(s) : typeof e.keysecondary === 'string' ? [e.keysecondary] : Array.isArray(e.alt) ? e.alt.map(s) : [],
        ...KEYWORDS_DEFAULT,
        scanDepth: typeof e.scanDepth === 'number' ? e.scanDepth : undefined,
      },
      time: {
        sticky: e.sticky === true,
        cooldownTurns: typeof e.cooldown === 'number' ? e.cooldown : undefined,
        delayTurns: typeof e.delay === 'number' ? e.delay : undefined,
        probability: typeof e.probability === 'number' ? clamp01(e.probability) : 1,
        reinsert: 'after',
      },
      injection: {
        position: injectionPosition(e),
        depth: typeof e.depth === 'number' ? e.depth : 0,
        order: idx,
        force: e.force === true,
      },
      group: e.group ? { key: str(e.group), weight: typeof e.groupWeight === 'number' ? e.groupWeight : 0 } : undefined,
    },
    relationTargets: [],
    importedFrom: undefined,
    unknownFields: extractUnknown(e),
  }
}

export function injectionPosition(e: Record<string, unknown>): 'beforeChar' | 'afterChar' | 'beforeExamples' | 'afterExamples' | 'beforeHistory' | 'afterHistory' | 'systemPrompt' | 'postHistoryInstructions' {
  const position = e.position === undefined ? 'beforeChar' : e.position
  if (typeof position !== 'number') {
    return safeInjectionPosition(String(position))
  }
  const q: Record<number, Parameters<typeof safeInjectionPosition>[0]> = {
    0: 'beforeChar',
    1: 'afterChar',
    2: 'beforeExamples',
    3: 'afterExamples',
    4: 'beforeHistory',
    5: 'afterHistory',
    6: 'systemPrompt',
    7: 'postHistoryInstructions',
  }
  return safeInjectionPosition(q[position] ?? 'beforeChar')
}

function safeInjectionPosition(v: string): 'beforeChar' | 'afterChar' | 'beforeExamples' | 'afterExamples' | 'beforeHistory' | 'afterHistory' | 'systemPrompt' | 'postHistoryInstructions' {
  return v === 'afterChar' || v === 'beforeExamples' || v === 'afterExamples' || v === 'beforeHistory' || v === 'afterHistory' || v === 'systemPrompt' || v === 'postHistoryInstructions' ? v : 'beforeChar'
}

function extractUnknown(c: Record<string, unknown>): UnknownRecord {
  const mapped = new Set(['name', 'description', 'personality', 'scenario', 'appearance', 'first_mes', 'mes_example', 'alternate_greetings', 'system_prompt', 'post_history_instructions', 'character_book'])
  const out: UnknownRecord = {}
  for (const [k, v] of Object.entries(c)) {
    if (!mapped.has(k)) out[k] = v
  }
  return out
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '')
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function listKnowledgeFromV2Book(book: Record<string, unknown> | null | undefined): KnowledgeEntry[] {
  if (!book) return []
  const entries = Array.isArray(book.entries) ? (book.entries as unknown[]) : []
  return entries.map((e, i) => (e && typeof e === 'object' && !Array.isArray(e) ? knowledgeFromV2Entry(i + 1, e as Record<string, unknown>) : null)).filter((x): x is KnowledgeEntry => x !== null)
}

export { ContentPart }