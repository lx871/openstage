export type MemoryTier = 'working' | 'episodic' | 'semantic'

export interface MemoryRecord {
  id: string
  tier: MemoryTier
  key?: string
  text: string
  subject?: string
  predicate?: string
  object?: string
  confidence?: number
  sourceMessageIds: string[]
  createdAt: string
  conversationId?: string
  embedding?: number[]
}

export interface MemoryQuery {
  text?: string
  tier?: MemoryTier
  key?: string
  topK?: number
}
