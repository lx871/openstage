import type { Character } from '@openstage/contracts'
import { characterFromV2 } from '@openstage/domain'
import type { RawCard } from './types.js'

export function v3ToCharacter(raw: RawCard): Character {
  const c = characterFromV2(raw.data, {})
  const data = raw.data
  if (data['nickname'] && typeof data['nickname'] === 'string') {
    c.unknownFields['nickname'] = data['nickname']
  }
  if (data['creator_notes_multilingual'] && typeof data['creator_notes_multilingual'] === 'object') {
    c.unknownFields['creator_notes_multilingual'] = data['creator_notes_multilingual']
  }
  if (data['character_version'] && typeof data['character_version'] === 'string') {
    c.unknownFields['character_version'] = data['character_version']
  }
  return c
}

export function characterToV3(character: Character): Record<string, unknown> {
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: character.identity.name,
      description: character.identity.description,
      personality: character.identity.personality,
      scenario: character.identity.scenario,
      first_mes: character.presentation.guide.greetingCandidates[0]?.text() ?? '',
      mes_example: character.presentation.guide.exampleMessages.join('\n'),
      alternate_greetings: character.presentation.guide.greetingCandidates.slice(1).map((c) => c.text()),
      system_prompt: character.behavior.systemOverrides['system_prompt'] ?? '',
      post_history_instructions: character.behavior.systemOverrides['post_history_instructions'] ?? '',
      character_book: undefined,
      tags: character.unknownFields['tags'] ?? [],
      creator: character.unknownFields['creator'] ?? '',
      extensions: character.unknownFields['extensions'] ?? {},
      character_version: character.unknownFields['character_version'] ?? '',
      nickname: character.unknownFields['nickname'] ?? '',
    },
  }
}
