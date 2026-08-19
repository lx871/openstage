import type { MemoryRecord } from './types.js'

export interface SummaryInput {
  conversationId: string
  tail: Array<{ role: string; name?: string; content: string }>
  prior?: MemoryRecord | null
}

export function summarizeTurn(input: SummaryInput, budget = 240): MemoryRecord {
  const text = input.tail
    .slice(-8)
    .map((m) => `${m.name ? m.name + ': ' : ''}${m.content.slice(0, 60)}`)
    .join(' | ')
  const summary = text.length > budget ? text.slice(0, budget) + '...' : text
  return {
    id: `summary-${input.conversationId}-${Date.now()}`,
    tier: 'episodic',
    text: summary || '（无可摘要内容）',
    sourceMessageIds: [],
    createdAt: new Date().toISOString(),
    conversationId: input.conversationId,
  }
}

export function extractFacts(text: string): Array<{ subject: string; predicate: string; object: string; confidence: number }> {
  const facts: Array<{ subject: string; predicate: string; object: string; confidence: number }> = []
  for (const line of text.split(/[。\n!！]/).map((s) => s.trim()).filter(Boolean)) {
    const m = line.match(/^(.{1,16})[是为有在](.{1,40})$/)
    if (m) facts.push({ subject: m[1]!.trim(), predicate: '是', object: m[2]!.trim(), confidence: 0.5 })
  }
  return facts
}
