import type { Character } from '@openstage/contracts'
import { characterFromV2 } from '@openstage/domain'
import type { RawCard } from './types.js'

export function v2ToCharacter(raw: RawCard): Character {
  return characterFromV2(raw.data, {})
}

export function characterToV2(character: Character): Record<string, unknown> {
  const altGreetings = character.presentation.guide.greetingCandidates.slice(1).map((c) => c.text())
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.identity.name,
      description: character.identity.description,
      personality: character.identity.personality,
      scenario: character.identity.scenario,
      first_mes: character.presentation.guide.greetingCandidates[0]?.text() ?? '',
      mes_example: character.presentation.guide.exampleMessages.join('\n'),
      alternate_greetings: altGreetings,
      system_prompt: character.behavior.systemOverrides['system_prompt'] ?? '',
      post_history_instructions: character.behavior.systemOverrides['post_history_instructions'] ?? '',
      character_book: undefined,
      tags: character.unknownFields['tags'] ?? [],
      creator: character.unknownFields['creator'] ?? '',
      creator_notes: character.unknownFields['creator_notes'] ?? '',
      extensions: character.unknownFields['extensions'] ?? {},
      ...filterKnown(character.unknownFields, ['tags', 'creator', 'creator_notes', 'extensions']),
    },
  }
}

function filterKnown(fields: Record<string, unknown>, exclude: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) if (!exclude.includes(k)) out[k] = v
  return out
}
