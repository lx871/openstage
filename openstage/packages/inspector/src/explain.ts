import { estimateTokens } from '@openstage/context-engine'
import type { PromptBlock, PromptPlan } from '@openstage/contracts'

export interface BlockTrace {
  id: string
  slot: PromptBlock['slot']
  stage: PromptBlock['stage']
  role: PromptBlock['role']
  sourceRef: PromptBlock['sourceRef']
  included: boolean
  tokenCount: number
  order: number
  inclusionReason?: string
  exclusionReason?: string
  contentPreview: string
  contentHash: number
}

export interface InspectorReport {
  conversationId: string
  recipeId: string
  mode: string
  stages: string[]
  createdAt: string
  warnings: string[]
  budget: PromptPlan['budget']
  cacheBreakpoints: PromptPlan['cacheBreakpoints']
  queries: PromptPlan['queries']
  blocks: BlockTrace[]
  tokenAttribution: Array<{ stage: string; allotted: number; used: number; dropped: number; share: number }>
  stablePrefixTokens: number
  volatileTokens: number
}

function hashPreview(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function planToReport(plan: PromptPlan): InspectorReport {
  const totalTokens = plan.blocks.filter((b) => b.included).reduce((a, b) => a + (b.tokenCount ?? estimateTokens(b.content)), 0)
  const tokenAttribution = plan.budget.map((b) => ({
    stage: b.stage,
    allotted: b.allotted,
    used: b.used,
    dropped: b.dropped,
    share: totalTokens > 0 ? b.used / totalTokens : 0,
  }))
  const stableSlots = new Set(['systemPrompt', 'beforeChar'])
  const volatileSlots = new Set(['afterHistory', 'postHistoryInstructions'])
  const stablePrefixTokens = plan.blocks.filter((b) => b.included && stableSlots.has(b.slot)).reduce((a, b) => a + b.tokenCount, 0)
  const volatileTokens = plan.blocks.filter((b) => b.included && volatileSlots.has(b.slot)).reduce((a, b) => a + b.tokenCount, 0)
  return {
    conversationId: plan.conversationId,
    recipeId: plan.recipeId,
    mode: plan.mode,
    stages: [...plan.stages],
    createdAt: plan.createdAt,
    warnings: [...plan.warnings],
    budget: [...plan.budget],
    cacheBreakpoints: [...plan.cacheBreakpoints],
    queries: plan.queries.map((q) => ({ ...q })),
    blocks: plan.blocks.map((b) => ({
      id: b.id,
      slot: b.slot,
      stage: b.stage,
      role: b.role,
      sourceRef: { ...b.sourceRef },
      included: b.included,
      tokenCount: b.tokenCount,
      order: b.order,
      inclusionReason: b.inclusionReason,
      exclusionReason: b.exclusionReason,
      contentPreview: b.content.slice(0, 160),
      contentHash: hashPreview(b.content),
    })),
    tokenAttribution,
    stablePrefixTokens,
    volatileTokens,
  }
}

export function whyNotInjected(plan: PromptPlan, idOrTitle: string): { found: boolean; included: boolean; reason?: string; query?: PromptPlan['queries'][number] } | null {
  const block = plan.blocks.find((b) => b.sourceRef.id === idOrTitle || b.sourceRef.name === idOrTitle || b.id === idOrTitle)
  if (block) return { found: true, included: block.included, reason: block.exclusionReason ?? block.inclusionReason }
  const query = plan.queries.find((q) => q.entryId === idOrTitle || q.title === idOrTitle)
  if (!query) return null
  const hit = plan.blocks.find((b) => b.sourceRef.id === query.entryId)
  if (hit) return { found: true, included: hit.included, reason: hit.exclusionReason, query }
  return { found: false, included: false, reason: 'entry not matched by WI activation', query }
}
