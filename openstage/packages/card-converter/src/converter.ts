import { extractPngTextChunk, parseCharacterJson } from '@openstage/storage'
import { characterFromV2, listKnowledgeFromV2Book } from '@openstage/domain'
import { uuid } from '@openstage/contracts'
import type { Character, KnowledgeBase, UnknownRecord } from '@openstage/contracts'
import type { ConvertResult, ExportOptions, RawCard } from './types.js'
import { normalizeRaw } from './detect.js'
import { v1ToCharacter } from './v1.js'
import { v2ToCharacter, characterToV2 } from './v2.js'
import { v3ToCharacter, characterToV3 } from './v3.js'
import { embedCardInPng } from './png.js'
import { objOf } from '@openstage/storage'

export function convertJsonString(raw: string): ConvertResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw Object.assign(new Error(`invalid JSON: ${(e as Error).message}`), { code: 'invalid_json' })
  }
  return convertRaw(parsed as UnknownRecord)
}

export function convertRaw(parsed: UnknownRecord): ConvertResult {
  const rawCard = normalizeRaw(parsed)
  let character: Character
  const warnings = [...rawCard.warnings]
  switch (rawCard.version) {
    case 'v1': character = v1ToCharacter(rawCard); break
    case 'v2': character = v2ToCharacter(rawCard); break
    case 'v3': character = v3ToCharacter(rawCard); warnings.push('V3 card imported via V2-compatible path; some V3-only fields preserved in unknownFields'); break
    default: character = characterFromV2(rawCard.data, { id: uuid() }); warnings.push('unknown version, best-effort V2 mapping applied'); break
  }
  const book = objOf(rawCard.data['character_book'])
  const entries = listKnowledgeFromV2Book(book as unknown as Parameters<typeof listKnowledgeFromV2Book>[0])
  const kb: KnowledgeBase | null = entries.length ? { id: uuid(), name: typeof rawCard.data['name'] === 'string' ? rawCard.data['name'] : undefined, entries, vectorized: false } : null
  if (kb) character.knowledgeEntryIds = kb.entries.map((e) => e.id)
  return { character, knowledgeBase: kb, sourceVersion: rawCard.version, warnings, rawCard }
}

export function convertPngBytes(bytes: Uint8Array): ConvertResult {
  const chunks = extractPngTextChunk(bytes)
  const json = chunks.find((c) => c.trim().startsWith('{'))
  if (!json) throw Object.assign(new Error('PNG has no embedded chara/ccv3 JSON'), { code: 'no_card_in_png' })
  return convertJsonString(json)
}

export function exportToJson(character: Character, knowledgeBase: KnowledgeBase | null, opts: ExportOptions): string {
  let out: Record<string, unknown>
  if (opts.targetVersion === 'v3') out = characterToV3(character)
  else out = characterToV2(character)
  const data = out['data'] as UnknownRecord
  if (knowledgeBase && knowledgeBase.entries.length) {
    data['character_book'] = {
      entries: knowledgeBase.entries.map((e, i) => ({
        id: i,
        keys: e.activation.keyword.primary,
        secondary_keys: e.activation.keyword.secondary,
        content: e.content,
        extensions: {},
        enabled: e.enabled,
        insertion_order: e.activation.injection.order,
        name: e.title ?? '',
        priority: 10,
        comment: e.comment ?? '',
        selective: e.unknownFields['selective'] ?? false,
        selectiveLogic: e.unknownFields['selectiveLogic'] ?? 0,
      })),
    }
  }
  if (!opts.includeExtensions) {
    // keep extensions key but strip heavy assets if caller wants lean export
  }
  return JSON.stringify(out, null, 2)
}

export function exportToPng(pngBytes: Uint8Array, character: Character, knowledgeBase: KnowledgeBase | null, opts: ExportOptions): Uint8Array {
  const json = exportToJson(character, knowledgeBase, opts)
  const keyword = opts.targetVersion === 'v3' ? 'ccv3' : 'chara'
  return embedCardInPng(pngBytes, json, keyword)
}

export type { RawCard, ConvertResult, ExportOptions }
