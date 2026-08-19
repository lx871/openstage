import type { Character, KnowledgeEntry, KnowledgeBase, UnknownRecord } from '@openstage/contracts'
import { uuid as uid } from '@openstage/contracts'
import { characterFromV2, knowledgeFromV2Entry } from '@openstage/domain'
import { assertEntryCount, assertSafeImportBuffer } from './validate-path.js'
import { extractPngTextChunk, objOf, parseCharacterJson } from './codecs.js'

export interface CharacterImportResult {
  data: Character
  knowledgeBase: KnowledgeBase | null
  path?: string
}

export function importCharacterBlob(blob: Uint8Array, path?: string): CharacterImportResult {
  assertSafeImportBuffer(blob)
  const chunks = extractPngTextChunk(blob)
  const cardJson = chunks.find((c) => c.startsWith('{'))
  if (cardJson === undefined) {
    if (blob.length > 2) throw Object.assign(new Error('PNG card missing chara chunk'), { code: 'invalid_card' })
    return importCharacterJson(blob as unknown as string, path)
  }
  if (cardJson.length > 5 * 1024 * 1024) throw Object.assign(new Error('embedded card JSON too large'), { code: 'file_too_large' })
  const parsed = parseCharacterJson(cardJson) as UnknownRecord
  return importCharacterObj(parsed, path)
}

export function importCharacterJson(raw: string, path?: string): CharacterImportResult {
  if (raw.length > 5 * 1024 * 1024) throw Object.assign(new Error('character JSON too large'), { code: 'file_too_large' })
  const parsed = parseCharacterJson(raw)
  return importCharacterObj(parsed, path)
}

export function importCharacterObj(card: UnknownRecord, path?: string): CharacterImportResult {
  const c = characterFromV2(card, { id: uid() })
  const book = objOf(card['character_book'])
  const kbEntries: KnowledgeEntry[] = []
  if (Array.isArray(book['entries'])) {
    assertEntryCount(book['entries'].length)
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