import type { PromptRole } from './domain.js';
import type { Id, UnknownRecord } from './base.js';
import type { PromptBlock, QueryDetail } from './prompt.js';

export interface RecipeV2Compatible {
  /** 配方 ID，默认 'compat-st-default' */
  id: string
  stages?: Array<{ id: string; budget?: number }>
}

export interface CompatPromptInputs {
  systemPrompt?: string
  jailbreakPrompt?: string
  personaDescription?: string
  charDescription?: string
  scenario?: string
  charPersonality?: string
  charName?: string
  postHistoryInstructions?: string
  linebreak?: string
  stopStrings?: string[]
  wrapInQuotes?: boolean
}

export interface CompatPromptConfig {
  name: string
  systemPrompt: string
  jailbreakPrompt: string
  personaDescription: string
  charDescription: string
  scenario: string
  charPersonality: string
  charName: string
  postHistoryInstructions: string
  linebreak?: string
  stopStrings?: string[]
  wrapInQuotes?: boolean
}

export interface PromptBlockSpec {
  id: string
  role: PromptRole
  injected: boolean
  marker: string | null
  injectionSlots: Array<'systemPrompt' | 'beforeChar' | 'afterChar' | 'inDialogue' | 'beforeExamples' | 'afterExamples' | 'beforeHistory' | 'inHistory' | 'afterHistory' | 'postHistoryInstructions'>
  injectionOrder: number
  injectionDepth: number
  content: string
  disabled: boolean
  includedInPrompt: boolean
}

export interface CompatContextGenOptions {
  conversationId: Id
  character: { name: string; avatar?: string; identity: unknown }
  allHistory: PromptBlock[]
  persona: string
  presetSoundBlocks: PromptBlockSpec[]
  worldInfoBefore: string
  worldInfoAfter: string
  mesExamples: string
  chatStartWrapper: string
  chatEndWrapper: string
}

export interface PipelineFold {
  slots: Partial<Record<string, string>>
  blocks: PromptBlock[]
  queries: QueryDetail[]
  order: string[]
  cache: UnknownRecord
}