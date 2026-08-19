import type { Character } from '@openstage/contracts'
import { characterFromV2 } from '@openstage/domain'
import type { RawCard } from './types.js'

export function v1ToCharacter(raw: RawCard): Character {
  return characterFromV2(raw.data, {})
}
