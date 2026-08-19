import type { Character, KnowledgeEntry, KnowledgeBase, UnknownRecord } from '@openstage/contracts'
import { uuid as uid } from '@openstage/contracts'
import { characterFromV2, knowledgeFromV2Entry } from '@openstage/domain'
import { extractPngTextChunk, objOf, parseCharacterJson } from './codecs.js'

export interface CharacterImportResult {
  data: Character
  knowledgeBase: KnowledgeBase | null
  path?: string
}

export function importCharacterBlob(blob: Uint8Array, path?: string): CharacterImportResult {
  const chunks = extractPngTextChunk(blob)
  const cardJson = chunks.find((c) => c.startsWith('{'))
  if (cardJson === undefined) return importCharacterJson(blob as unknown as string, path)
  const parsed = parseCharacterJson(cardJson) as UnknownRecord
  return importCharacterObj(parsed, path)
}

export function importCharacterJson(raw: string, path?: string): CharacterImportResult {
  const parsed = parseCharacterJson(raw)
  return importCharacterObj(parsed, path)
}

export function importCharacterObj(card: UnknownRecord, path?: string): CharacterImportResult {
  const c = characterFromV2(card, { id: uid() })
  const book = objOf(card['character_book'])
  const kbEntries: KnowledgeEntry[] = []
  if (Array.isArray(book['entries'])) {
    for (const raw of book['entries'] as unknown[]) {
      const e = knowledgeFromV2Entry(kbEntries.length + 1, objOf(raw))
      if (e) kbEntries.push(e)
    }
  }
  c.knowledgeEntryIds = kbEntries.map((e) => e.id)
  const kb: KnowledgeBase | null = kbEntries.length
    ? {
        id: uid(),
        name: (typeof card['name'] === 'string' ? card['name'] : undefined),
        entries: kbEntries,
        vectorized: false,
      }
    : null
  return { data: c, knowledgeBase: kb, path }
}

export { extractPngTextChunk, parseCharacterJson }