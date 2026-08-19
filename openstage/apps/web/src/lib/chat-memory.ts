import type { Block } from '@openstage/contracts'

export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'system'; name?: string; blocks: Block[]; at: string }
export interface Conversation { id: string; characterId: string; messages: ChatMessage[]; createdAt: string }

function key(cid: string): string { return `openstage.conv.${cid}` }
function idxKey(): string { return 'openstage.conv.index' }

export function listConversations(): string[] {
  try { return JSON.parse(localStorage.getItem(idxKey()) ?? '[]') as string[] } catch { return [] }
}
export function saveConversation(c: Conversation): void {
  if (JSON.stringify(c).length > 1_000_000) throw Object.assign(new Error('conversation too large'), { code: 'too_large' })
  localStorage.setItem(key(c.id), JSON.stringify(c))
  const idx = new Set(listConversations()); idx.add(c.id)
  if (idx.size > 200) { const arr = [...idx]; for (const old of arr.slice(0, idx.size - 200)) localStorage.removeItem(key(old)) }
  localStorage.setItem(idxKey(), JSON.stringify([...idx].slice(-200)))
}
export function loadConversation(id: string): Conversation | null {
  try { const raw = localStorage.getItem(key(id)); return raw ? JSON.parse(raw) as Conversation : null } catch { return null }
}
export function deleteConversation(id: string): void {
  localStorage.removeItem(key(id))
  const idx = listConversations().filter((x) => x !== id)
  localStorage.setItem(idxKey(), JSON.stringify(idx))
}
