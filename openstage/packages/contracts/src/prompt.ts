import type { PromptRole } from './domain.js'
import type { Id, SourceRef, TokenUsage, UnknownRecord } from './base.js'

export type PipelineStageName =
  | 'system'
  | 'identity'
  | 'lore'
  | 'memory'
  | 'examples'
  | 'history'
  | 'annotation'
  | 'post-history'

export type InjectionSlot =
  | 'systemPrompt'
  | 'beforeChar'
  | 'afterChar'
  | 'inDialogue'
  | 'beforeExamples'
  | 'afterExamples'
  | 'beforeHistory'
  | 'inHistory'
  | 'afterHistory'
  | 'postHistoryInstructions'

export interface PromptBlock {
  id: string
  sourceRef: SourceRef
  stage: PipelineStageName
  role: PromptRole
  content: string
  rawContent?: string
  included: boolean
  slot: InjectionSlot
  order: number
  depth: number
  tokenCount: number
  inclusionReason?: string
  exclusionReason?: string
  macroExpanded: boolean
}

export interface BudgetLine {
  stage: PipelineStageName
  allotted: number
  used: number
  dropped: number
}

export interface QueryDetail {
  entryId: string
  title?: string
  mode: 'keyword' | 'semantic' | 'graph'
  matchedKeys: string[]
  score: number
}

export interface CacheBreakpoint {
  slot: InjectionSlot
  afterBlockId?: string
  reason: 'stable' | 'semi-stable' | 'volatile'
}

export interface PromptPlan {
  conversationId: Id
  recipeId: string
  mode: 'compat' | 'native'
  stages: PipelineStageName[]
  blocks: PromptBlock[]
  budget: BudgetLine[]
  queries: QueryDetail[]
  cacheBreakpoints: CacheBreakpoint[]
  createdAt: string
  preset: UnknownRecord
  warnings: string[]
}

export interface PromptDelta {
  added: PromptBlock[]
  removed: PromptBlock[]
  changed: Array<{ blockId: string; field: string; before?: string; after?: string }>
}

export interface ProviderRequest {
  provider: string
  model: string
  endpoint: string
  headers: Record<string, string>
  body: UnknownRecord
  estimatedTokens: TokenUsage
}

export interface ContextDraft {
  slots: Partial<Record<InjectionSlot, string>>
  blocks: PromptBlock[]
  queries: QueryDetail[]
  order: InjectionSlot[]
  cacheBreakpoints: CacheBreakpoint[]
}