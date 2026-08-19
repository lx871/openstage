import type { KnowledgeEntry, KnowledgeBase, Character } from '@openstage/contracts'
import { uuid } from '@openstage/contracts'

export interface KnowledgeRepo {
  kbs: Map<string, KnowledgeBase>
  charToKb: Map<string, string>
}

export function createKnowledgeRepo(): KnowledgeRepo {
  return { kbs: new Map(), charToKb: new Map() }
}

export function addKnowledgeBase(repo: KnowledgeRepo, kb: KnowledgeBase): void {
  repo.kbs.set(kb.id, kb)
}

export function linkCharacterKb(repo: KnowledgeRepo, characterId: string, kb: KnowledgeBase | null): void {
  if (!kb) return
  repo.kbs.set(kb.id, kb)
  repo.charToKb.set(characterId, kb.id)
}

export function entriesForCharacter(repo: KnowledgeRepo, character: Character): KnowledgeEntry[] {
  const kbId = repo.charToKb.get(character.id)
  const kb = kbId ? repo.kbs.get(kbId) : null
  if (kb) return kb.entries
  return character.knowledgeEntryIds
    .map((id) => Array.from(repo.kbs.values()).flatMap((k) => k.entries).find((e) => e.id === id))
    .filter((e): e is KnowledgeEntry => !!e)
}

export type { KnowledgeEntry, KnowledgeBase }
export { uuid }